package main

import (
	"errors"
	"fmt"
	ntdll "github.com/hillu/go-ntdll"
	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/registry"
	"os"
	"os/exec"
	"strings"
	"syscall"
	"unsafe"
)

var PROCESS_ALL_ACCESS = uint32(
	windows.PROCESS_QUERY_INFORMATION |
		windows.PROCESS_VM_READ |
		windows.PROCESS_VM_WRITE |
		windows.PROCESS_VM_OPERATION |
		windows.PROCESS_CREATE_THREAD |
		windows.PROCESS_DUP_HANDLE |
		windows.PROCESS_TERMINATE |
		windows.PROCESS_SUSPEND_RESUME |
		windows.PROCESS_SET_QUOTA |
		windows.PROCESS_SET_INFORMATION |
		windows.PROCESS_QUERY_LIMITED_INFORMATION)

// 定义一些 Windows API 结构体
type SYSTEM_HANDLE_TABLE_ENTRY_INFO64 struct {
	UniqueProcessId       uint16
	CreatorBackTraceIndex uint16
	ObjectTypeIndex       uint8
	HandleAttributes      uint8
	HandleValue           uint16
	Object                uint64
	GrantedAccess         uint32
}

func main() {
	fmt.Println("args", os.Args)
	processList, err := GetWeChatProcess()
	var path string
	if processList != nil && len(processList) > 0 {
		fmt.Println("找到微信进程")
		path, err = GetProcessPath(processList[0])
		if err != nil {
			fmt.Println("尝试获取微信进程路径失败", err)
			fmt.Println("尝试通过注册表查询微信路径")

			path, err = queryWechatRegistry()
			if err != nil {
				fmt.Println("查询注册表失败：" + err.Error())
				return
			}
		}
		fmt.Println("微信进程数量:", len(processList))
		fmt.Println("开始杀多开句柄")
		err = doKillWechatProcessWeChatMutexList(processList)
		if err != nil {
			fmt.Println(err)
			return
		}
	} else if len(os.Args) >= 2 {
		fmt.Println("从参数获取微信路径")
		path = os.Args[1]
	} else if err == windows.ERROR_NO_MORE_FILES {
		fmt.Println("没有找到微信进程")
		fmt.Println("尝试通过注册表查询微信路径")
		// 查询注册表
		path, err = queryWechatRegistry()
		if err != nil {
			fmt.Println("查询注册表失败：" + err.Error())
			return
		}
	} else {
		fmt.Println("执行失败：" + err.Error())
		return
	}

	fmt.Println("微信进程路径:", path)
	// 启动微信进程，通过fork运行
	cmd := exec.Command(path)
	err = cmd.Start()
	if err != nil {
		fmt.Println("启动微信失败：" + err.Error())
		return
	}
	fmt.Println("启动微信成功")
}

func doKillWechatProcessWeChatMutexList(processList []windows.ProcessEntry32) error {
	for _, process := range processList {
		err := KillWeChatMutex(process)
		if err != nil {
			fmt.Println("杀进程失败：", err)
			return err
		}

		fmt.Println("Kill WeChat Mutex Success!", process.ProcessID)
	}

	return nil
}

func queryWechatRegistry() (string, error) {
	// 查询注册表
	path, err := QueryRegistry("Software\\Tencent\\WeChat", "InstallPath")
	if err != nil {
		fmt.Println("查询注册表失败：" + err.Error())
		return "", err
	}

	path += "\\WeChat.exe"

	return path, nil
}

// 查询注册表
func QueryRegistry(path string, key string) (string, error) {
	openKey, err := registry.OpenKey(registry.CURRENT_USER, path, registry.QUERY_VALUE)
	if err != nil {
		return "", err
	}
	defer openKey.Close()
	value, _, err := openKey.GetStringValue(key)
	if err != nil {
		return "", err
	}
	return value, nil
}

func GetProcessPath(process windows.ProcessEntry32) (string, error) {
	processHandle, err := windows.OpenProcess(PROCESS_ALL_ACCESS, false, process.ProcessID)
	if err != nil {
		return "", err
	}
	defer windows.CloseHandle(processHandle)

	var size uint32 = 1024
	var buffer = make([]uint16, size)

	err = windows.QueryFullProcessImageName(processHandle, 0, &buffer[0], &size)
	if err != nil {
		return "", err
	}

	return syscall.UTF16ToString(buffer[:size]), nil
}

// 获取微信进程对象，包含进程ID、进程句柄和Module列表
func GetWeChatProcess() ([]windows.ProcessEntry32, error) {
	var process windows.ProcessEntry32
	process.Size = uint32(unsafe.Sizeof(process))
	snapshot, err := windows.CreateToolhelp32Snapshot(windows.TH32CS_SNAPPROCESS, 0)
	if err != nil {
		return nil, err
	}
	defer windows.CloseHandle(snapshot)
	var processList []windows.ProcessEntry32

	for {
		err = windows.Process32Next(snapshot, &process)
		if err != nil {
			return processList, err
		}
		if windows.UTF16ToString(process.ExeFile[:]) == "WeChat.exe" {
			processList = append(processList, process)
		}
	}
}

// 杀微信互斥体
func KillWeChatMutex(process windows.ProcessEntry32) error {
	buffer, status := NtQuerySystemInformation(windows.SystemHandleInformation)
	if status != nil {
		return status
	}

	pid_map := make(map[int][]*SYSTEM_HANDLE_TABLE_ENTRY_INFO64)

	size := int(unsafe.Sizeof(SYSTEM_HANDLE_TABLE_ENTRY_INFO64{}))
	for i := 8; i < len(buffer); i += size {
		handle_info := (*SYSTEM_HANDLE_TABLE_ENTRY_INFO64)(unsafe.Pointer(
			uintptr(unsafe.Pointer(&buffer[0])) + uintptr(i)))

		pid := int(handle_info.UniqueProcessId)
		handle_group, _ := pid_map[pid]
		handle_group = append(handle_group, handle_info)
		pid_map[pid] = handle_group
	}

	// 获取微信进程的句柄
	var handleList = pid_map[int(process.ProcessID)]

	fmt.Printf("进程：%d, 句柄数量：%d\n", process.ProcessID, len(handleList))

	// 通过 DuplicateHandle 访问句柄
	for _, handle := range handleList {
		err := FindAndCloseWeChatMutexHandle(*handle, process.ProcessID)
		if err != nil {
			return err
		}
	}

	return nil
}

// A sane version which allocates the right size buffer.
func NtQuerySystemInformation(class int32) ([]byte, error) {
	// Start off with something reasonable.
	buffer_size := 1024 * 1024 * 4
	var length uint32

	// A hard upper limit on the buffer.
	for buffer_size < 32*1024*1024 {
		buffer := make([]byte, buffer_size)

		status := windows.NtQuerySystemInformation(class,
			unsafe.Pointer(&buffer[0]), uint32(len(buffer)), &length)
		if status == windows.STATUS_SUCCESS {
			return buffer[:length], nil
		}

		// Buffer needs to grow
		if status == windows.STATUS_INFO_LENGTH_MISMATCH {
			buffer_size += 1024 * 1024 * 4
			continue
		}

		return buffer, status
	}
	return nil, errors.New("Too much memory needed")
}

func FindAndCloseWeChatMutexHandle(systemHandleInfo SYSTEM_HANDLE_TABLE_ENTRY_INFO64, processId uint32) error {
	openProcessHandle, err := windows.OpenProcess(PROCESS_ALL_ACCESS, false, processId)
	if err != nil {
		return err
	}
	defer windows.CloseHandle(openProcessHandle)

	handleValue := uintptr(systemHandleInfo.HandleValue)
	var h windows.Handle

	// 获取当前进程的句柄
	err = windows.DuplicateHandle(openProcessHandle, windows.Handle(handleValue), windows.CurrentProcess(), &h, 0, false, windows.DUPLICATE_SAME_ACCESS)
	if err != nil {
		return nil
	}
	defer windows.CloseHandle(h)

	// 查询句柄名称
	buffer := make([]byte, 1024*2)
	var length uint32

	status := ntdll.NtQueryObject(ntdll.Handle(h), ntdll.ObjectNameInformation,
		&buffer[0], uint32(len(buffer)), &length)
	if status != ntdll.STATUS_SUCCESS {
		return fmt.Errorf("NtQueryObject failed: %v", status)
	}

	var handleUnicodeData = (*ntdll.UnicodeString)(unsafe.Pointer(&buffer[0]))
	var handleName = handleUnicodeData.String()
	if handleName == "" {
		return nil
	}

	if !strings.Contains(handleName, "_WeChat_App_Instance_Identity_Mutex_Name") {
		return nil
	}

	var closeH windows.Handle
	// 获取当前进程的句柄
	err = windows.DuplicateHandle(openProcessHandle, windows.Handle(handleValue), windows.CurrentProcess(), &closeH, 0, false, windows.DUPLICATE_CLOSE_SOURCE)
	if err != nil {
		return err
	}
	//  \Sessions\1\BaseNamedObjects\_WeChat_App_Instance_Identity_Mutex_Name
	status = ntdll.NtClose(ntdll.Handle(closeH))

	if status != ntdll.STATUS_SUCCESS {
		return fmt.Errorf("NtClose failed: %v", status)
	}

	return nil
}

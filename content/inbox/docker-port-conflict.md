# Windows 端口被占用（EADDRINUSE）快速定位与释放

刚启动本地服务遇到 `Error: listen EADDRINUSE: address already in use :::5173` 时随手记一下 PowerShell 一键排查命令：

```powershell
# 查看占用 5173 端口的进程 PID
Get-NetTCPConnection -LocalPort 5173 | Select-Object LocalAddress, LocalPort, OwningProcess

# 根据 PID 结束进程
Stop-Process -Id <PID> -Force
```

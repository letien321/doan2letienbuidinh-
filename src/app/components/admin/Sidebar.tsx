  import { BatteryCharging, LayoutDashboard, Zap, History, Settings, LogOut } from "lucide-react";
  import { Button } from "../ui/button";
  
  interface SidebarProps {
    activeMenu: string;
    onMenuChange: (menu: string) => void;
    onLogout: () => void;
  }
  
  export function Sidebar({ activeMenu, onMenuChange, onLogout }: SidebarProps) {
    const menuItems = [
      { id: "dashboard", label: "Tổng quan", icon: LayoutDashboard },
      { id: "stations", label: "Trạm sạc", icon: Zap },
      { id: "history", label: "Lịch sử", icon: History },
      { id: "settings", label: "Cài đặt", icon: Settings },
    ];
  
    return (
      <aside className="w-72 bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 text-white flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-blue-500 rounded-xl flex items-center justify-center shadow-lg">
              <BatteryCharging className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-xl text-white">EV Station</h1>
              <p className="text-xs text-gray-400">Quản lý hệ thống</p>
            </div>
          </div>
        </div>
  
        {/* Menu */}
        <nav className="flex-1 p-4 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeMenu === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onMenuChange(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 ${
                  isActive
                    ? "bg-gradient-to-r from-green-500 to-blue-600 text-white shadow-lg shadow-green-500/30 scale-105"
                    : "text-gray-300 hover:bg-gray-700/50 hover:text-white"
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? "" : "opacity-70"}`} />
                <span className="font-semibold">{item.label}</span>
              </button>
            );
          })}
        </nav>
  
        {/* Footer */}
        <div className="p-4 border-t border-gray-700">
          <div className="mb-4 p-4 bg-gray-700/50 rounded-xl">
            <p className="text-xs text-gray-400 mb-1">Quản trị viên</p>
            <p className="font-semibold text-white">Admin User</p>
          </div>
          <Button
            variant="ghost"
            onClick={onLogout}
            className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-500/10"
          >
            <LogOut className="w-5 h-5 mr-3" />
            Đăng xuất
          </Button>
        </div>
      </aside>
    );
  }
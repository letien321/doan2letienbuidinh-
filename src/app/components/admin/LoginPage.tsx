import { useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { BatteryCharging, User, Lock } from "lucide-react";

interface LoginPageProps {
  onLogin: () => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username && password) {
      onLogin();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-green-600 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto w-20 h-20 bg-gradient-to-br from-green-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
            <BatteryCharging className="w-10 h-10 text-white" />
          </div>
          <CardTitle className="text-3xl">Quản Lý Trạm Sạc</CardTitle>
          <CardDescription>
            Đăng nhập để quản lý hệ thống trạm sạc xe điện
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Tên đăng nhập</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="username"
                  type="text"
                  placeholder="Nhập tên đăng nhập"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mật khẩu</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Nhập mật khẩu"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded border-gray-300" />
                <span className="text-gray-600">Ghi nhớ đăng nhập</span>
              </label>
            </div>
            <Button type="submit" className="w-full bg-gradient-to-r from-green-500 to-blue-600 hover:from-green-600 hover:to-blue-700">
              Đăng nhập
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

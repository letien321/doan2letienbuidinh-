import { useState } from "react";
import { LoginPage } from "./components/admin/LoginPage";
import { Sidebar } from "./components/admin/Sidebar";
import { DashboardScreen } from "./components/admin/DashboardScreen";
import { StationsScreen } from "./components/admin/StationsScreen";
import { StationDetailScreen } from "./components/admin/StationDetailScreen";
import { HistoryScreen } from "./components/admin/HistoryScreen";
import { SettingsScreen } from "./components/admin/SettingsScreen";

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeMenu, setActiveMenu] = useState("dashboard");
  const [selectedStationId, setSelectedStationId] = useState<number | null>(null);

  const handleLogout = () => {
    setIsLoggedIn(false);
    setActiveMenu("dashboard");
  };

  const handleViewStationDetail = (stationId: number) => {
    setSelectedStationId(stationId);
    setActiveMenu("station-detail");
  };

  const handleBackToStations = () => {
    setSelectedStationId(null);
    setActiveMenu("stations");
  };

  if (!isLoggedIn) {
    return <LoginPage onLogin={() => setIsLoggedIn(true)} />;
  }

  const renderContent = () => {
    if (activeMenu === "station-detail" && selectedStationId) {
      return (
        <StationDetailScreen
          stationId={selectedStationId}
          onBack={handleBackToStations}
        />
      );
    }

    switch (activeMenu) {
      case "dashboard":
        return <DashboardScreen onViewStation={handleViewStationDetail} />;
      case "stations":
        return <StationsScreen onViewDetail={handleViewStationDetail} />;
      case "history":
        return <HistoryScreen />;
      case "settings":
        return <SettingsScreen />;
      default:
        return <DashboardScreen onViewStation={handleViewStationDetail} />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar
        activeMenu={activeMenu}
        onMenuChange={setActiveMenu}
        onLogout={handleLogout}
      />
      <main className="flex-1 overflow-auto">
        {renderContent()}
      </main>
    </div>
  );
}

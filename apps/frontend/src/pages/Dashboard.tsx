import { SideBar } from "../components/dashboard/SideBar";
import { TopBar } from "../components/dashboard/TopBar";
import { Services } from "../components/Services";

export function DashBoard() {
    return (
        <div className="dash-layout">
            <TopBar />
            <div className="dash-body">
                <SideBar />
                <main className="dash-content">
                    <div className="content-inner">
                        <h1 className="dash-section-title">Services</h1>
                        <Services />
                        
                        <h2 className="dash-section-title secondary">Other</h2>
                        <div className="placeholder-area">
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
import "./header.css";
import { FiLogOut } from "react-icons/fi";

export default function Header({ name, avatar }) {

    function onLogout() {
        console.log("Hello")
    }

    return (
        <header className="dashboard-header">
            <span>Text to Speech</span>

            <div className="user-profile">
                <ul>
                    <li>Recents</li>
                </ul>
                <button className="logout-button" onClick={onLogout}>
                    <FiLogOut className="logout-icon" />
                    <span>Logout</span>
                </button>
            </div>
        </header>
    );
}

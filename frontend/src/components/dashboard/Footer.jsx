import { FaGithub } from "react-icons/fa";

const Footer = () => {
    return (
        <div className="footer-credit">
            <a
                href="https://github.com/Aliko2020/"
                target="_blank"
                rel="noopener noreferrer"
                className="github-link"
            >
                <FaGithub className="github-icon" />
                <span>aliko amos @2025</span>
            </a>
        </div>
    )
}

export default Footer
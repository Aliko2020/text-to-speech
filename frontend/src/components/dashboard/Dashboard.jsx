import { useEffect, useState } from "react";
import { useAuth } from "react-oidc-context";
import { FaGithub } from "react-icons/fa";
import Header from "./Header";
import "./dashboard.css";

export default function Dashboard() {
  const auth = useAuth();

  const [text, setText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [audioUrl, setAudioUrl] = useState(""); 

  useEffect(() => {
    if (!auth.isAuthenticated) {
      auth.signinRedirect();
    }
  }, [auth]);

  if (!auth.isAuthenticated) return <div>Redirecting to login...</div>;

  const user = {
    name: auth.user?.profile?.name || auth.user?.profile?.email || "User",
    avatar: auth.user?.profile?.picture || "https://via.placeholder.com/40",
  };

  const handleTextChange = (e) => {
    setText(e.target.value);
  };

  const handleConvert = async () => {
    if (!text.trim()) return;

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/convert", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw new Error("Conversion failed");
      }

      const data = await response.json();

      setAudioUrl(data.audioUrl);
    } catch (error) {
      console.error("Error converting text:", error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="dashboard-container">
      <Header
        name={user.name}
        avatar={user.avatar}
        onLogout={() => auth.signoutRedirect()}
      />

      <main className="dashboard-main">
        <div className="card">
          <div className="card-details">
            <h3 className="card-title">Text to Speech Converter</h3>
            <textarea
              className="text-area"
              rows={4}
              placeholder="Enter your text here..."
              value={text}
              onChange={handleTextChange}
            />
            <select className="dropdown">
              <option>Amy (British English)</option>
            </select>
            <button
              className="convert-button"
              onClick={handleConvert}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Converting..." : "Convert to Speech"}
            </button>

            {audioUrl && (
              <>
                <audio controls className="audio-player">
                  <source src={audioUrl} type="audio/mpeg" />
                  Your browser does not support the audio element.
                </audio>
                <a
                  href={audioUrl}
                  download="converted-audio.mp3"
                  className="download-button"
                >
                  Download Audio
                </a>
              </>
            )}
          </div>

          <div className="footer-credit">
            <a
              href="https://github.com/alikoamos"
              target="_blank"
              rel="noopener noreferrer"
              className="github-link"
            >
              <FaGithub className="github-icon" />
              <span>aliko amos @2025</span>
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}

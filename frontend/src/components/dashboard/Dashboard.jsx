import { useEffect, useState } from "react";
import { useAuth } from "react-oidc-context";
import Header from "./Header";
import Footer from "./Footer";
import { FaDownload } from 'react-icons/fa';

import "./dashboard.css";

import { convertTextToSpeech } from "../../api/convertApi";

export default function Dashboard() {
  const auth = useAuth();

  const [text, setText] = useState("");
  const [selectedVoice, setSelectedVoice] = useState("Amy"); // Default voice
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [audioUrl, setAudioUrl] = useState("");
  const [error, setError] = useState(null);

  const apiUrl = "https://35smzwnuoc.execute-api.us-east-1.amazonaws.com/dev/convert";

  const voices = [
    { name: "Amy", label: "Amy (British English)" },
    { name: "Brian", label: "Brian (British English)" },
    { name: "Joanna", label: "Joanna (US English)" },
    { name: "Matthew", label: "Matthew (US English)" },
    { name: "Aditi", label: "Aditi (Indian English)" },
    { name: "Raveena", label: "Raveena (Indian English)" },
    { name: "Mizuki", label: "Mizuki (Japanese)" },
    { name: "Hans", label: "Hans (German)" },
  ];

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

  const handleVoiceChange = (e) => {
    setSelectedVoice(e.target.value);
  };

  const handleConvert = async () => {
    if (!text.trim()) {
      setError("Please enter some text.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setAudioUrl("");

    try {
      const token = auth.user?.access_token;

      if (!token) {
        throw new Error("User is not authenticated");
      }

      // ✅ Pass voice to API
      const result = await convertTextToSpeech(text, token, apiUrl, selectedVoice);
      setAudioUrl(result.audio_url);
    } catch (err) {
      console.error("Error converting text:", err);
      setError(err.message || "Conversion failed");
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

            {/* ✅ Voice selection dropdown */}
            <select
              className="dropdown"
              value={selectedVoice}
              onChange={handleVoiceChange}
            >
              {voices.map((voice) => (
                <option key={voice.name} value={voice.name}>
                  {voice.label}
                </option>
              ))}
            </select>

            <button
              className="convert-button"
              onClick={handleConvert}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Converting..." : "Convert to Speech"}
            </button>

            {error && <p className="error-message">{error}</p>}

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
                  <FaDownload style={{ marginRight: '8px' }} />
                  Download Audio
                </a>
              </>
            )}
          </div>
          <Footer />
        </div>
      </main>
    </div>
  );
}

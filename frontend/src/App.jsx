import { useAuth } from "react-oidc-context";
import { useEffect } from "react";
import { useNavigate, Routes, Route, useLocation } from "react-router-dom";
import Dashboard from "./components/dashboard/Dashboard";
import Spinner from "./components/Spinner"

function App() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (auth.isLoading) return;

    if (!auth.isAuthenticated) {
      auth.signinRedirect();
      return;
    }

    if (auth.isAuthenticated && location.pathname === "/") {
      navigate("/dashboard", { replace: true });
    }
  }, [auth.isLoading, auth.isAuthenticated, location.pathname, navigate, auth]);

  if (auth.isLoading) {
    return (
      <Spinner />
    );
  }

  if (auth.error) {
    return <div>Authentication error: {auth.error.message}</div>;
  }

  return (
    <Routes>
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/recents" element={<Dashboard />} />
    </Routes>
  );
}

export default App;

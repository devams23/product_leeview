import React from "react";
import ReactDOM from "react-dom/client";

function Popup() {
  return (
    <div style={{ width: "200px", padding: "16px" }}>
      <h1>LeeView</h1>
      <p>AI Mock Interview</p>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<Popup />);

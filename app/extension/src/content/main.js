import { jsx as _jsx } from "react/jsx-runtime";
import ReactDOM from "react-dom/client";
import App from "./App";
const root = document.createElement("div");
root.id = "leeview-root";
document.body.appendChild(root);
ReactDOM.createRoot(root).render(_jsx(App, {}));

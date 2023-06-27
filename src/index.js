import * as React from "react";
import * as ReactDOM from "react-dom";
import "./index.css";
import App from "./pages/ExamplePage";

ReactDOM.render(<App key={"app"}></App>, document.getElementById("root"), () => {
  console.log('rootFiber callback')
});

// ReactDOM.createRoot(
//   document.getElementById('root')
// ).render(<App />);
import * as React from "react";
import * as ReactDOM from "react-dom";
import "./index.css";
import App from "./pages/ExamplePage";

ReactDOM.render(<App></App>, document.getElementById("root"), () => {
  console.log('rootFiber callback')
});
console.log("React 版本===", React.version); //sy-log

import {React, Component, useState} from "../CONST";

class ClassComponent extends Component {
  render() {
    return <div className="class border">{this.props.name}</div>;
  }
}

function FunctionComponent({name}) {
  const [count, setCount] = useState(0)
  return (
    <div className="function border">
      {name}
      {count}
      <button onClick={() => setCount(count+1)}>click</button>
    </div>
  );
}
const App = () => {
  return (
    <div className="box border">
      <p>
        <span>方</span>
        <span>哈哈</span>
      </p>
      <FunctionComponent  name="哇哈哈"></FunctionComponent>
      <ClassComponent name="哇哈哈"></ClassComponent>
    </div>
  )
}
const jsx = (
  <div className="box border">
    <p>
      <span>方</span>
      <span>哈哈</span>
    </p>
    <FunctionComponent  name="哇哈哈"></FunctionComponent>
    <ClassComponent name="哇哈哈"></ClassComponent>
  </div>
);
console.log('react 版本===', React.version)
export default App;

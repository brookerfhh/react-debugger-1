import {React, Component, useState} from "./CONST";

class ClassComponent extends Component {
  state = {
    count: 0
  }
  render() {
    const { count } = this.state
    return <div className="class border" onClick={() => this.setState({
      count: count+1
    })}>{count}</div>;
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
      <ClassComponent name="class-hh"></ClassComponent>
      <FunctionComponent  name="function-hh"></FunctionComponent>
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

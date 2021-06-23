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

const jsx = (
  <div className="box border">
    <p>开课吧</p>
    {/* <a href="https://kaikeba.com/">开课吧</a>
    <FunctionComponent name="函数组件" />
    <ClassComponent name="class组件" /> */}
  </div>
);
console.log('react 版本===', React.version)
export default jsx;

import React from 'react';
import Test from './Test';

export default class App extends React.Component {
    x(y: string) {
        return y;
    }

    render() {
        console.log(this.x(150));
        return <Test />;
    }
}

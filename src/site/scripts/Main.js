import BaseClass from './BaseClass.js';
import Enhancements from './Enhancements.js';

class Main extends BaseClass {
  constructor() {    
    super();
    new Enhancements();
  }
}

export default Main;
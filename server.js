const configs = require('./configs/index');
const app = require('./app')(configs);

app.start(configs);

// Http server use with:
/*
Invoke-WebRequest -Uri "http://localhost:3030/LogAggregator"
Invoke-WebRequest -Uri "http://localhost:3030/RegisterAll"
Invoke-WebRequest -Uri "http://localhost:3030/UnregisterAll"
Invoke-WebRequest -Uri "http://localhost:3030/LogRootEndpoint"

const server = http.createServer((req, res) => {
  if (req.url === '/UnregisterAll') {
    logger.warn('UnregisterAll signal received.');
    matterAggregator.removeBridgedDevice(matterDevice1!);
    matterAggregator.removeBridgedDevice(matterDevice2!);
    matterAggregator.removeBridgedDevice(matterDevice3!);
  } else if (req.url === '/RegisterAll') {
    logger.warn('RegisterAll signal received.');
    matterAggregator.addChildEndpoint(matterDevice1!);
    matterAggregator.addChildEndpoint(matterDevice2!);
    matterAggregator.addChildEndpoint(matterDevice3!);
  } else if (req.url === '/LogRootEndpoint') {
    logger.warn('LogRootEndpoint signal received.');
    logEndpoint(commissioningServer.getRootEndpoint());
  } else if (req.url === '/LogAggregator') {
    logger.warn('LogAggregator signal received.');
    logEndpoint(matterAggregator);
  }
  res.end('Signal processed');
});

server.listen(3030);

*/

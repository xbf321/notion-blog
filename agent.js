module.exports = agent => {
  // 需要等 App Worker 启动成功后才能发送，否则可能丢失消息。
  agent.messenger.on('egg-ready', () => {
    agent.messenger.sendRandom('init_data');
  });
};

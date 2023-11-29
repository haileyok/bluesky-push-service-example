const currTime = (): string => {
  const date = new Date();

  const hour = date.getHours();
  const minute = date.getMinutes();
  const second = date.getSeconds();

  return `${hour < 10 ? '0' : ''}${hour}:${minute < 10 ? '0' : ''}${minute}:${
    second < 10 ? '0' : ''
  }${second}`;
};

export const log = (message: string): void => {
  console.log(`[${currTime()}]: ${message}`);
};

export const debug = (message: string): void => {
  if (process.env.DEBUG === 'true') log(message);
};

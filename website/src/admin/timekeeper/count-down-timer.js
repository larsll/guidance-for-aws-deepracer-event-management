import { Header } from '@cloudscape-design/components';
import React, { useEffect, useState } from 'react';

const CountDownTimer = (props) => {
  const [timerId, setTimerId] = useState();
  const [time, setTime] = useState(props.duration);

  const { isRunning, duration, isReset, onExpire } = props;

  useEffect(() => {
    if (isReset === true) {
      setTime(duration);
    }
  }, [isReset, duration]);

  useEffect(() => {
    if (isRunning) {
      console.log('Starting race timer');
      const timeDecrease = 1000;
      if (!timerId) {
        const timerId = setInterval(() => {
          setTime((previousTime) => {
            let newTime = previousTime - timeDecrease;
            if (newTime <= 0) {
              newTime = 0;
              onExpire(true);
              clearInterval(timerId);
              setTimerId(null);
            }
            return newTime;
          });
        }, timeDecrease);
        setTimerId(timerId);
      }
    } else {
      console.log('Stopping race timer');
      clearInterval(timerId);
      setTimerId(null);
    }
  }, [isRunning, timerId, onExpire]);

  const convertMsToString = (timeInMS) => {
    const seconds = Math.floor(timeInMS / 1000);
    const secondsAsString = String(Math.floor(timeInMS / 1000) % 60).padStart(2, '0');
    const minutesAsString = String(Math.floor(seconds / 60)).padStart(2, '0');
    const timeAsString = `${minutesAsString}:${secondsAsString}`;
    return timeAsString;
  };

  // TODO start to flash timer when closing down to 00:00
  return <Header>{convertMsToString(time)}</Header>;
};

export { CountDownTimer };
// TODO ensure automatic timer (websocket) is working properly

import { Box, Button, Container, Grid, Header, SpaceBetween } from '@cloudscape-design/components';
import React, { useContext, useEffect, useRef, useState } from 'react';

import useCounter from '../../hooks/useCounter';
import { eventContext } from '../../store/EventProvider';
import SideNavContext from '../../store/SideNavContext';
import { EndSessionModal } from './end-session-modal';
import { LapTable } from './lap-table';
import LapTimer from './LapTimer';
import { RacerSelectionModal } from './racer-selector-modal';
import RaceTimer from './RaceTimer';
import styles from './timekeeper.module.css';

const Timekeeper = () => {
  const [racerSelecorModalIsVisible, SetRacerSelectorModalIsVisible] = useState(true);
  const [endSessionModalIsVisible, SetEndSessionModalIsVisible] = useState(false);
  const [timersAreRunning, SetTimersAreRunning] = useState(false);

  const [username, SetUsername] = useState();
  const lapTemplate = {
    id: null,
    time: 0,
    resets: 0,
    crashes: 0,
    isValid: false,
  };
  const [currentLap, SetCurrentLap] = useState(lapTemplate);

  const [laps, SetLaps] = useState([]);
  const [fastestLap, SetFastestLap] = useState([]);

  const [isLastLap, SetIsLastLap] = useState(false);

  const connected = false; // TODO remove when activating websocket (automated timer)
  // const { message, connected } = useWebsocket('ws://localhost:8080');
  const { setNavigationOpen } = useContext(SideNavContext);
  const { events, selectedEvent, setSelectedEvent } = useContext(eventContext);

  const [
    carResetCounter,
    incrementCarResetCounter,
    decrementCarResetCounter,
    resetCarResetCounter,
  ] = useCounter(0);

  const lapTimerRef = useRef();
  const raceTimerRef = useRef();

  // closes sidenav when time keeper page is open
  useEffect(() => {
    setNavigationOpen(false);
  }, [setNavigationOpen]);

  // Find the fastest lap
  useEffect(() => {
    if (laps.length) {
      // Get all valid laps
      const validLaps = laps.filter((o) => {
        return o.isValid === true;
      });
      if (validLaps.length) {
        // Find fastest time
        var res = Math.min.apply(
          Math,
          validLaps.map((o) => {
            return o.time;
          })
        );
        // Get object with the fastets time
        const obj = validLaps.find((o) => {
          return o.time === res;
        });
        SetFastestLap([obj]);
      } else {
        SetFastestLap([]);
      }
    } else {
      SetFastestLap([]);
    }
  }, [laps]);

  // handlers functions
  const endSessionHandler = () => {
    SetEndSessionModalIsVisible(true);
  };

  const captureNewLapHandler = (lapIsValid) => {
    const lapId = laps.length;
    const currentLapStats = {
      ...currentLap,
      resets: carResetCounter,
      id: lapId,
      time: lapTimerRef.current.getCurrentTimeInMs(),
      isValid: lapIsValid,
    };

    SetLaps((prevState) => {
      return [...prevState, currentLapStats];
    });
    SetCurrentLap(lapTemplate);
    resetCarResetCounter();
    lapTimerRef.current.reset();

    // Check if race is over and this is the last lap
    if (isLastLap) {
      pauseTimers();
    }
  };

  const submitRaceHandler = () => {
    console.log('Submit race');
    resetRace();
  };

  const abandonRaceHandler = () => {
    console.log('Abandon race');
    resetRace();
  };

  const raceIsOverHandler = () => {
    console.log('Race is over!');
    SetIsLastLap(true);
  };

  const raceStartedHandler = (username) => {
    console.log('Start race for user: ' + username);
    SetUsername(username);
    SetRacerSelectorModalIsVisible(false);
    resetTimers();
  };

  const actionHandler = (id) => {
    console.log('alter lap status for lap id: ' + id);
    const lapsCopy = [...laps];
    const updatedLap = { ...laps[id] };
    updatedLap.isValid = !updatedLap.isValid;
    lapsCopy[id] = updatedLap;
    SetLaps(lapsCopy);
  };

  const raceHandler = () => {
    console.warn('username: ' + username);
    if (username === undefined) {
      SetRacerSelectorModalIsVisible(true);
      resetTimers();
    } else if (lapTimerRef.current.getIsRunning()) {
      pauseTimers();
    } else {
      startTimers();
    }
  };

  const endSessionModalDismissed = () => {
    SetEndSessionModalIsVisible(false);
  };

  const racerSelectionModalDismissedHandler = () => {
    SetRacerSelectorModalIsVisible(false);
    // TODO display warning that a racer need to be selected
  };

  const undoFalseFinishHandler = () => {
    SetLaps((prevState) => {
      const updatedLaps = [...prevState];
      if (updatedLaps.length !== 0) {
        const lastLap = updatedLaps.pop();
        lapTimerRef.current.reset(lapTimerRef.current.getCurrentTimeInMs() + lastLap.time);
      }
      return updatedLaps;
    });
  };

  // support functions
  const startTimers = () => {
    lapTimerRef.current.start();
    raceTimerRef.current.start();
    SetTimersAreRunning(true);
  };

  const pauseTimers = () => {
    lapTimerRef.current.pause();
    raceTimerRef.current.pause();
    SetTimersAreRunning(false);
  };

  const resetTimers = () => {
    pauseTimers();
    raceTimerRef.current.reset(selectedEvent.raceTimeInSec * 1000);
    lapTimerRef.current.reset();
  };

  const resetLaps = () => {
    SetLaps([]);
    SetIsLastLap(false);
    SetCurrentLap(lapTemplate);
  };

  const resetRace = () => {
    console.log('Reseting race');
    SetUsername();
    resetTimers();
    resetLaps();

    // Restart racer selection
    SetEndSessionModalIsVisible(false);
    SetRacerSelectorModalIsVisible(true);
  };

  return (
    <Box margin={{ top: 'l' }} textAlign="center">
      <RacerSelectionModal
        onRacerSelected={raceStartedHandler}
        onDismiss={racerSelectionModalDismissedHandler}
        visible={racerSelecorModalIsVisible}
        events={events}
        onSelectedEvent={setSelectedEvent}
      />
      <EndSessionModal
        onSubmitRace={submitRaceHandler}
        onAbandonRace={abandonRaceHandler}
        onDismiss={endSessionModalDismissed}
        onAction={actionHandler}
        username={username}
        laps={laps}
        selectedEvent={selectedEvent}
        visible={endSessionModalIsVisible}
      />
      <Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }]}>
        <Container>
          <Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }]}>
            <Header>Current Racer:</Header>
            <Header>{username}</Header>
          </Grid>
          <hr></hr>
          <Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }, { colspan: 6 }, { colspan: 6 }]}>
            <Header>Time Left: </Header>
            <RaceTimer onExpire={raceIsOverHandler} ref={raceTimerRef} />
            <Header>Current Lap:</Header>
            <LapTimer ref={lapTimerRef} />
          </Grid>
          <hr></hr>
          <Grid
            gridDefinition={[
              { colspan: 6 },
              { colspan: 6 },
              { colspan: 12 },
              { colspan: 12 },
              { colspan: 12 },
              { colspan: 2 },
              { colspan: 3 },
              { colspan: 7 },
              { colspan: 12 },
              { colspan: 6 },
              { colspan: 6 },
            ]}
            className={styles.root}
          >
            <Button onClick={captureNewLapHandler.bind(null, false)}>DNF</Button>
            <Button onClick={incrementCarResetCounter}>Car Reset</Button>
            <Button onClick={captureNewLapHandler.bind(null, true)} disabled={!timersAreRunning}>
              Capture Lap
            </Button>
            <div>{connected ? 'Automated timer connected' : 'Automated timer not connected'} </div>
            <hr></hr>
            <Grid>
              <div>Resets:</div>
              <div>
                {carResetCounter}/{selectedEvent.numberOfResets}
              </div>
            </Grid>
            <Button onClick={decrementCarResetCounter}>-1</Button>
            <Button onClick={undoFalseFinishHandler}>Undo false finish</Button>
            <hr></hr>
            <Button onClick={endSessionHandler}>End Race</Button>
            <Button onClick={() => raceHandler()}>
              {!timersAreRunning ? 'Start Race' : 'Pause Race'}
            </Button>
          </Grid>
        </Container>
        <Grid gridDefinition={[{ colspan: 12 }, { colspan: 12 }]}>
          <SpaceBetween size="m" direction="horizontal">
            <LapTable header={'Fastest Lap'} laps={fastestLap} onAction={actionHandler} />
            <LapTable header={'Recorded Laps'} laps={laps} onAction={actionHandler} />
          </SpaceBetween>
        </Grid>
      </Grid>
    </Box>
  );
};

export { Timekeeper };
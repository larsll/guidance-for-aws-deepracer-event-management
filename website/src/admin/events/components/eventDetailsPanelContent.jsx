import { Box, ColumnLayout, Grid, SpaceBetween } from '@cloudscape-design/components';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { EventLinksButtons } from '../../../components/eventLinksButtons';
import { Flag } from '../../../components/flag';
import awsconfig from '../../../config.json';
import { useFleetsContext, useUsersContext } from '../../../store/storeProvider';
import { formatAwsDateTime } from '../../../support-functions/time';
import { GetTypeOfEventNameFromId } from '../support-functions/eventDomain';
import {
  GetRaceResetsNameFromId,
  GetRankingNameFromId,
  GetTrackTypeNameFromId,
} from '../support-functions/raceConfig';

export const EventDetailsPanelContent = ({ event }) => {
  const { t } = useTranslation();

  const [users, usersIsLoading, getUserNameFromId] = useUsersContext();
  const [, , getFleetNameFromId] = useFleetsContext();
  const attributeField = (header, value) => {
    return (
      <SpaceBetween size="xxxs">
        <Box fontWeight="bold">{header}:</Box>
        <div>{value ?? '-'}</div>
      </SpaceBetween>
    );
  };
  // JSX

  return (
    <ColumnLayout columns={4} variant="text-grid">
      <Grid gridDefinition={[{ colspan: 12 }, { colspan: 12 }, { colspan: 12 }, { colspan: 12 }]}>
        {attributeField(t('events.event-type'), GetTypeOfEventNameFromId(event.typeOfEvent))}
        {attributeField(t('events.event-date'), event.eventDate)}
        {attributeField(t('events.created-at'), formatAwsDateTime(event.createdAt) || '-')}
        {attributeField(t('events.created-by'), getUserNameFromId(event.createdBy || '-'))}
      </Grid>
      <Grid
        gridDefinition={[
          { colspan: 12 },
          { colspan: 12 },
          { colspan: 12 },
          { colspan: 12 },
          { colspan: 12 },
        ]}
      >
        {attributeField(t('events.event-date'), event.eventDate)}
        {attributeField(t('events.country'), <Flag countryCode={event.countryCode}></Flag>)}
        {attributeField(t('events.fleet-info.label'), getFleetNameFromId(event.fleetId))}
        {attributeField(
          t('events.leaderboard.header'),
          event.tracks[0].leaderboardConfig.headerText
        )}
        {attributeField(
          t('events.leaderboard.footer'),
          event.tracks[0].leaderboardConfig.footerText
        )}
      </Grid>
      <Grid gridDefinition={[{ colspan: 12 }, { colspan: 12 }, { colspan: 12 }, { colspan: 12 }]}>
        {attributeField(
          t('events.race.ranking-method'),
          GetRankingNameFromId(event.tracks[0].raceConfig.rankingMethod)
        )}
        {attributeField(
          t('events.track-type'),
          GetTrackTypeNameFromId(event.tracks[0].raceConfig.trackType)
        )}
        {attributeField(t('events.race.race-time'), event.tracks[0].raceConfig.raceTimeInMin)}
        {attributeField(
          t('events.race.resets-per-lap'),
          GetRaceResetsNameFromId(event.tracks[0].raceConfig.numberOfResetsPerLap)
        )}
      </Grid>
      <Grid gridDefinition={[{ colspan: 12 }, { colspan: 12 }, { colspan: 12 }, { colspan: 12 }]}>
        {attributeField(
          t('events.leaderboard-link'),

          <EventLinksButtons
            href={`${
              awsconfig.Urls.leaderboardWebsite
            }/leaderboard/${event.eventId.toString()}/?qr=header&scroll=true`}
            linkTextPrimary={t('events.leaderboard-link-same-tab')}
            linkTextExternal={t('events.leaderboard-link-new-tab')}
          />
        )}
        {attributeField(
          t('events.streaming-overlay-link'),

          <EventLinksButtons
            href={`${awsconfig.Urls.streamingOverlayWebsite}/${event.eventId.toString()}`}
            linkTextPrimary={t('events.streaming-overlay-link-same-tab')}
            linkTextExternal={t('events.streaming-overlay-link-new-tab')}
          />
        )}
        {attributeField(
          t('events.streaming-overlay-link-chroma'),

          <EventLinksButtons
            href={`${awsconfig.Urls.streamingOverlayWebsite}/${event.eventId.toString()}?chroma=1`}
            linkTextPrimary={t('events.streaming-overlay-link-chroma-same-tab')}
            linkTextExternal={t('events.streaming-overlay-link-chroma-new-tab')}
          />
        )}
        {attributeField(
          t('events.landing-page-link'),
          <EventLinksButtons
            href={`${awsconfig.Urls.leaderboardWebsite}/landing-page/${event.eventId.toString()}/`}
            linkTextPrimary={t('events.landing-page-link-same-tab')}
            linkTextExternal={t('events.landing-page-link-new-tab')}
          />
        )}
      </Grid>
    </ColumnLayout>
  );
};
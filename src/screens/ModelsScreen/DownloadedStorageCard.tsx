import React, {useContext} from 'react';
import {View} from 'react-native';
import {observer} from 'mobx-react-lite';
import {Card, Text, useTheme} from 'react-native-paper';

import {modelStore} from '../../store';
import {L10nContext} from '../../utils';
import {t} from '../../locales';
import {formatBytes} from '../../utils/formatters';

/**
 * Summary of on-device model storage (downloaded models only).
 * Hidden when nothing is downloaded yet.
 */
export const DownloadedStorageCard: React.FC = observer(() => {
  const theme = useTheme();
  const l10n = useContext(L10nContext);

  const downloaded = modelStore.models.filter(m => m.isDownloaded);
  if (downloaded.length === 0) {
    return null;
  }
  const totalBytes = downloaded.reduce((sum, m) => sum + (m.size || 0), 0);

  return (
    <Card
      elevation={0}
      testID="downloaded-storage-card"
      // eslint-disable-next-line react-native/no-inline-styles
      style={{marginHorizontal: 16, marginTop: 8, marginBottom: 4}}>
      <Card.Content
        // eslint-disable-next-line react-native/no-inline-styles
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
        <Text variant="titleSmall">{l10n.models.downloadedModels}</Text>
        <View testID="downloaded-storage-summary">
          <Text
            variant="bodyMedium"
            style={{color: theme.colors.onSurfaceVariant}}>
            {t(l10n.models.downloadedSummary, {
              count: downloaded.length,
              size: formatBytes(totalBytes),
            })}
          </Text>
        </View>
      </Card.Content>
    </Card>
  );
});

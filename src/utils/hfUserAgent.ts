import DeviceInfo from 'react-native-device-info';

/**
 * User-Agent for outbound Hugging Face requests (API + model downloads).
 * The `(com.nexusai.nexus)` token is a fixed attribution key on both platforms.
 */
export const hfUserAgent = (): string =>
  `PocketPal/${DeviceInfo.getVersion()} (com.nexusai.nexus)`;

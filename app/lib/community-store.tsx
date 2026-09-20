import { createContext, useCallback, useContext, useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { AppState } from 'react-native';
import { roadAPI, type RoadDevice, type RoadIncident } from './evidence';
import { readDevice, writeDevice } from './evidence-device';

type Community = {
  device: RoadDevice | null;
  reports: RoadIncident[];
  setReports: Dispatch<SetStateAction<RoadIncident[]>>;
  loaded: boolean;
  loadError: string;
  deviceError: string;
  refresh: () => Promise<void>;
  settings: (patch: Partial<RoadDevice>) => Promise<void>;
};
const Context = createContext<Community | null>(null);

export function CommunityProvider({ children }: { children: ReactNode }) {
  const [device, setDevice] = useState<RoadDevice | null>(null);
  const [reports, set] = useState<RoadIncident[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [deviceError, setDeviceError] = useState('');
  const deviceRef = useRef<RoadDevice | null>(null);
  const saving = useRef(Promise.resolve());
  const revision = useRef(0);
  const alive = useRef(true);
  const fetching = useRef(false);
  const setReports: Community['setReports'] = useCallback((value) => {
    revision.current++;
    set(value);
  }, []);
  const refresh = useCallback(async () => {
    if (fetching.current) return;
    fetching.current = true;
    const request = ++revision.current;
    try {
      const data = await roadAPI.list();
      if (!alive.current || request !== revision.current) return;
      set(data.incidents);
      setLoaded(true);
      setLoadError('');
    } catch {
      if (!alive.current || request !== revision.current) return;
      setLoaded(true);
      setLoadError('Community is offline. Connect again to check your reports and savings.');
    } finally { fetching.current = false; }
  }, []);
  useEffect(() => {
    alive.current = true;
    readDevice().then(async (value) => {
      await writeDevice(value);
      if (alive.current) { deviceRef.current = value; setDevice(value); }
    }).catch(() => {
      if (alive.current) setDeviceError('Your community profile could not be opened. Reopen the app or free device storage.');
    });
    void refresh();
    const timer = setInterval(() => {
      if (AppState.currentState === 'active' || AppState.currentState == null) void refresh();
    }, 8000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => { alive.current = false; revision.current++; clearInterval(timer); subscription.remove(); };
  }, [refresh]);
  const settings = useCallback((patch: Partial<RoadDevice>) => {
    const task = saving.current.then(async () => {
      if (!deviceRef.current) throw new Error('Your community profile is not ready.');
      const next = { ...deviceRef.current, ...patch };
      await writeDevice(next);
      deviceRef.current = next;
      if (alive.current) setDevice(next);
    });
    saving.current = task.catch(() => {});
    return task;
  }, []);
  return <Context.Provider value={{ device, reports, setReports, loaded, loadError, deviceError, refresh, settings }}>{children}</Context.Provider>;
}
export function useCommunity() {
  const value = useContext(Context);
  if (!value) throw new Error('useCommunity outside CommunityProvider');
  return value;
}

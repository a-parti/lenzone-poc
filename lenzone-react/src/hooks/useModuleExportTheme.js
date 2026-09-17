import { useEffect, useState } from 'react';
import { useTheme } from '../context/ThemeContext';

// A module can preview/export in a different mode without changing the rest of the site. The
// banner's global mode remains authoritative: whenever it changes, every module drops its local
// override and follows the banner again.
export default function useModuleExportTheme() {
  const { mode: globalMode, scheme } = useTheme();
  const [theme, setTheme] = useState(globalMode);

  useEffect(() => {
    setTheme(globalMode);
  }, [globalMode]);

  return { theme, setTheme, scheme };
}

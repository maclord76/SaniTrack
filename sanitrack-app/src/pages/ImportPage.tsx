import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { importAllData } from '@/db/export-import';
import { decryptJsonPayload, isEncryptedExportPayload } from '@/utils/encryption';

function ImportPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const uuid = searchParams.get('uuid');
    const server = searchParams.get('server');
    const keyword = searchParams.get('key') ?? '';

    if (!uuid || !server) {
      navigate('/', { replace: true });
      return;
    }

    (async () => {
      try {
        const response = await fetch(`${server}/api/upload.php?uuid=${encodeURIComponent(uuid)}`);
        if (!response.ok) {
          const err = await response.json().catch(() => null);
          throw new Error(err?.error || `Erreur serveur (${response.status})`);
        }
        const data = await response.json();
        const importData = isEncryptedExportPayload(data)
          ? await decryptJsonPayload(data, keyword)
          : data;
        await importAllData(importData, { clearExisting: true });

        await fetch(`${server}/api/upload.php?uuid=${encodeURIComponent(uuid)}`, { method: 'DELETE' }).catch(() => {});

        navigate('/', { replace: true });
      } catch {
        navigate('/', { replace: true });
      }
    })();
  }, [searchParams, navigate]);

  return (
    <div className="mx-auto max-w-md py-12 text-center">
      <p className="text-sm text-slate-600 dark:text-slate-400">Importation en cours...</p>
    </div>
  );
}

export { ImportPage };

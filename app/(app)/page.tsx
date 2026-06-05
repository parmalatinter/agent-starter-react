import { headers } from 'next/headers';
import { App } from '@/components/app';
import { getAppConfig } from '@/lib/utils';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const [hdrs, params] = await Promise.all([headers(), searchParams]);
  const appConfig = await getAppConfig(hdrs);
  const token = params.token ?? null;

  return <App appConfig={appConfig} token={token} />;
}

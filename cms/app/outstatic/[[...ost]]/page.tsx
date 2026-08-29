import 'outstatic/outstatic.css';
import { Outstatic } from 'outstatic';
import { OstClient } from 'outstatic/client';

// Next 15/16 pass `params` as a Promise. The published Outstatic docs still show
// the older synchronous signature; this is the form the package's own apps use.
export default async function Page(props: { params: Promise<{ ost: string[] }> }) {
  const params = await props.params;
  const ostData = await Outstatic();
  return <OstClient ostData={ostData} params={params} />;
}

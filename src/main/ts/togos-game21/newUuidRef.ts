import { newType4Uuid, uuidUrn } from 'tshash/uuids'

export default function newUuidRef():string { return uuidUrn(newType4Uuid()); }

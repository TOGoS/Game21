import MemoryDatastore from './MemoryDatastore.ts';
import {testDatastore} from './DatastoreTest.ts';

testDatastore( 'MemoryDatastore', MemoryDatastore.createSha1Based(1) );

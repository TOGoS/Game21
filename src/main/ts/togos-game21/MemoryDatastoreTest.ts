/// <reference path="../Promise.d.ts" />

import MemoryDatastore from './MemoryDatastore';
import {testDatastore} from './DatastoreTest';

testDatastore( 'MemoryDatastore', MemoryDatastore.createSha1Based(1) );

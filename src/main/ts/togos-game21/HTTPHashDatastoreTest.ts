/// <reference path="../Promise.d.ts" />

import HTTPHashDatastore from './HTTPHashDatastore';
import {testDatastore} from './DatastoreTest';

testDatastore( 'HTTPHashDatastore', new HTTPHashDatastore() );

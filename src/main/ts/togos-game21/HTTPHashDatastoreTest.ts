import HTTPHashDatastore from './HTTPHashDatastore.ts';
import {testDatastore} from './DatastoreTest.ts';

testDatastore( 'HTTPHashDatastore', HTTPHashDatastore.createDefault() );

import { utf8Encode, sha1Urn } from '../tshash/index';
import { assertEquals } from './testing';

const data = '{\n'+
	'	"bounds": {\n'+
	'		"minX": -8,\n'+
	'		"minY": -8,\n'+
	'		"minZ": -0.5,\n'+
	'		"maxX": 8,\n'+
	'		"maxY": 8,\n'+
	'		"maxZ": 0.5\n'+
	'	},\n'+
	'	"roomEntities": {\n'+
	'		"urn:uuid:d42a8340-ec03-482b-ae4c-a1bfdec4ba32": {\n'+
	'			"position": {"x":-4.5,"y":-1.5,"z":0},\n'+
	'			"entity": {\n'+
	'				"id": "urn:uuid:d42a8340-ec03-482b-ae4c-a1bfdec4ba32",\n'+
	'				"classRef": "urn:uuid:416bfc18-7412-489f-a45e-6ff4c6a4e08b",\n'+
	'				"desiredMovementDirection": {"x":0,"y":0,"z":0}\n'+
	'			},\n'+
	'			"velocity": {"x":0,"y":-0.002422480620155043,"z":0},\n'+
	'			"velocityPosition": {"x":-4.5,"y":-1.4380556344985962,"z":0}\n'+
	'		},\n'+
	'		"urn:uuid:a11ed6ae-f096-4b30-bd39-2a78d39a1385": {\n'+
	'			"position": {"x":0,"y":0,"z":0},\n'+
	'			"entity": {\n'+
	'				"classRef": "urn:sha1:PM6O2GPBIOCNJHUB66OAAK3IEDD3BJ7B#"\n'+
	'			}\n'+
	'		},\n'+
	'		"urn:uuid:10070a44-2a0f-41a1-bcfb-b9e16a6f1b59": {\n'+
	'			"position": {"x":-2.5,"y":-3.25,"z":0},\n'+
	'			"entity": {\n'+
	'				"classRef": "urn:uuid:762f0209-0b91-4084-b1e0-3aac3ca5f5ab"\n'+
	'			},\n'+
	'			"velocity": {"x":0,"y":-0.10416552424430847,"z":0},\n'+
	'			"velocityPosition": {"x":-2.5,"y":-3.188720703125,"z":0}\n'+
	'		},\n'+
	'		"urn:uuid:27c27635-99ba-4ef3-b3ff-445eb9b132e5": {\n'+
	'			"position": {"x":5.5,"y":0,"z":0},\n'+
	'			"entity": {\n'+
	'				"classRef": "urn:uuid:585927b9-b225-49d7-a49a-dff0445a1f78",\n'+
	'				"desiredMovementDirection": {"x":0,"y":-1,"z":0}\n'+
	'			},\n'+
	'			"velocity": {"x":0,"y":0.19791666666666652,"z":0}\n'+
	'		}\n'+
	'	},\n'+
	'	"neighbors": {\n'+
	'		"w": {\n'+
	'			"offset": {"x":-16,"y":0,"z":0},\n'+
	'			"bounds": {\n'+
	'				"minX": -8,\n'+
	'				"minY": -8,\n'+
	'				"minZ": -0.5,\n'+
	'				"maxX": 8,\n'+
	'				"maxY": 8,\n'+
	'				"maxZ": 0.5\n'+
	'			},\n'+
	'			"roomRef": "urn:uuid:9d424151-1abf-45c1-b581-170c6eec5942"\n'+
	'		},\n'+
	'		"e": {\n'+
	'			"offset": {"x":16,"y":0,"z":0},\n'+
	'			"bounds": {\n'+
	'				"minX": -8,\n'+
	'				"minY": -8,\n'+
	'				"minZ": -0.5,\n'+
	'				"maxX": 8,\n'+
	'				"maxY": 8,\n'+
	'				"maxZ": 0.5\n'+
	'			},\n'+
	'			"roomRef": "urn:uuid:9d424151-1abf-45c1-b581-170c6eec5942"\n'+
	'		},\n'+
	'		"n": {\n'+
	'			"offset": {"x":0,"y":-16,"z":0},\n'+
	'			"bounds": {\n'+
	'				"minX": -8,\n'+
	'				"minY": -8,\n'+
	'				"minZ": -0.5,\n'+
	'				"maxX": 8,\n'+
	'				"maxY": 8,\n'+
	'				"maxZ": 0.5\n'+
	'			},\n'+
	'			"roomRef": "urn:uuid:9d424151-1abf-45c1-b581-170c6eec5941"\n'+
	'		},\n'+
	'		"s": {\n'+
	'			"offset": {"x":0,"y":16,"z":0},\n'+
	'			"bounds": {\n'+
	'				"minX": -8,\n'+
	'				"minY": -8,\n'+
	'				"minZ": -0.5,\n'+
	'				"maxX": 8,\n'+
	'				"maxY": 8,\n'+
	'				"maxZ": 0.5\n'+
	'			},\n'+
	'			"roomRef": "urn:uuid:9d424151-1abf-45c1-b581-170c6eec5941"\n'+
	'		}\n'+
	'	}\n'+
	'}\n';

// Somehow this comes out to urn:sha1:4ICMYBMGJE3AYSOXISMEADOJPROW2AH2!!!!

const encoded = utf8Encode(data);
const urn = sha1Urn(encoded);
assertEquals('urn:sha1:EGZEU6OEHVMLAXVFJDRQW6SBLAT3CEZX', urn);

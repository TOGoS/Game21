import {
	MazeGenerator,
	MazeTester,
	MazeLink,
	MazePlayerState,
	playerStateId,
	ITEMCLASS_BLUEKEY,
	ITEMCLASS_YELLOWKEY,
} from './randommazegeneration2';

for( let i=0; i<100; ++i ) {
	const generator = new MazeGenerator();
	generator.requireKeys = [ITEMCLASS_BLUEKEY];
	const maze = generator.generate();
	const tester = new MazeTester(maze);
	const soln = tester.solve();
	try {
		tester.assertGoodMaze();
	} catch( err ) {
		console.error(err.message);
		process.exit(1);
	}
}

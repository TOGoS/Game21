import {
	ITEMCLASS_BLUEKEY
} from '../graphmaze.ts';
import MazeGenerator from './GraphMazeGenerator2.ts';
import MazeSolver from './GraphMazeSolver.ts';

for( let i=0; i<100; ++i ) {
	const generator = new MazeGenerator();
	generator.requireKeys = [ITEMCLASS_BLUEKEY];
	const maze = generator.generate();
	const tester = new MazeSolver(maze);
	const soln = tester.solve();
	tester.assertGoodMaze();
}

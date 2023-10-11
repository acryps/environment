export const convertToEnvironmentVariableName = (...path: string[]) => {
	return path.join('_').replace(/[A-Z]/g, match => `_${match}`).toUpperCase();
}
module.exports = ({ b }) => {
	const insert = b`"use strict";`;

	console.clear();

	return b`
		// comment before an inserted node
		${insert}
	`;
};
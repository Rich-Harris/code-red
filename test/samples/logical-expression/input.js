module.exports = ({ b }) => {
  return b`
    a ?? (b || c);
    (a ?? b) || c;
  `;
}
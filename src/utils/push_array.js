export function push_array(this_array, ...other_array_list) {
  let count = 0;
  for (let a = 0; a < other_array_list.length; a++) {
    const other_array = other_array_list[a];
    for (let i = 0; i < other_array.length; i++) {
      this_array.push(other_array[i]);
    }
    count += other_array.length;
  }
  return count;
};

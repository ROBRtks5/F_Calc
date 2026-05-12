fetch("https://iss.moex.com/iss/engines/futures/markets/forts/securities/S1M6.json")
  .then(res => res.json())
  .then(data => {
    const secCols = data.securities.columns;
    const secRow = data.securities.data[0];
    const getVal = (name) => secRow[secCols.indexOf(name)];
    console.log("SECID:", getVal("SECID"));
    console.log("MINSTEP:", getVal("MINSTEP"));
    console.log("STEPPRICE:", getVal("STEPPRICE"));
    console.log("LOTVOLUME:", getVal("LOTVOLUME"));
  });

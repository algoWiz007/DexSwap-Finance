const fs= require('fs');
const path= require('path');

const abiPrefix = "abi.";
const abiFiles = [
    [
        '../build/DEXswapRouter.json',
    ],
];

function generateAbi(abiFile) {
    let total = [];
    let filename;
    for(let i = 0; i < abiFile.length; ++i) {
        if (!filename) {
            let parsed = path.parse(abiFile[i]);
            filename = path.format({
                dir: __dirname,
                name: abiPrefix.concat(parsed.name),
                ext: parsed.ext
            });
        }

        let content = fs.readFileSync(__dirname+'/'+abiFile[i], 'utf8');
        let json = JSON.parse(content);
        for(let k= 0; k< json.abi.length; ++k) {
            if(0 === i || json.abi[k].type == 'event') {
            total.push(json.abi[k])
        }
    }
    }
    console.log("abi path:",filename);
    fs.writeFileSync(filename, JSON.stringify(total));
}

function main () {
    abiFiles.forEach(abiFile => {
        generateAbi(abiFile);
    });
}

main();

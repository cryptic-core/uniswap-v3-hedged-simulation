var chart_d = null
var scatter_points_raw = []
var scatter_points_raw_fee = []
var scatter_points_hdeged = []
var scatter_points = []

var profitlow = 0
var profithigh = -99999999999
const getTokenAmountsFromDepositAmounts = (P,Pl,Pu,priceUSDX,priceUSDY,targetAmounts)=>{
    
    deltaL = targetAmounts / ((Math.sqrt(P) - Math.sqrt(Pl)) * priceUSDY + 
            (1 / Math.sqrt(P) - 1 / Math.sqrt(Pu)) * priceUSDX)
  
    deltaY = deltaL * (Math.sqrt(P) - Math.sqrt(Pl))
    if (deltaY * priceUSDY < 0)
      deltaY = 0
    if (deltaY * priceUSDY > targetAmounts)
      deltaY = targetAmounts / priceUSDY
  
    deltaX = deltaL * (1 / Math.sqrt(P) - 1 / Math.sqrt(Pu))
    if (deltaX * priceUSDX < 0)
      deltaX = 0;
    if (deltaX * priceUSDX > targetAmounts)
      deltaX = targetAmounts / priceUSDX
    
    return {deltaX,deltaY}
}

const calcLiquidity = (
    cprice,
    upper,
    lower,
    amountX,
    amountY
)=>{
    let liquidity = 0
    if(cprice <= lower){
        liquidity = amountX * (Math.sqrt(upper) * Math.sqrt(lower)) / (Math.sqrt(upper) - Math.sqrt(lower))
    }else if(upper < cprice){
        let Lx = amountX * (Math.sqrt(upper) * Math.sqrt(cprice)) / (Math.sqrt(upper) - Math.sqrt(cprice))
        let Ly = amountY / (Math.sqrt(cprice) - Math.sqrt(lower))
        liquidity = Math.min(Lx,Ly)
    }else{
        liquidity = amountY / (Math.sqrt(upper) - Math.sqrt(lower))
    }
    return liquidity
}

const getILPriceChange = (
    price,
    newPrice,
    upper,
    lower,
    amountX,
    amountY
  )=>{
    let L = calcLiquidity(price,upper,lower,amountX,amountY)
    let deltaP = Math.sqrt(newPrice) - Math.sqrt(price)
    let oneOverDeltaP = 1/(Math.sqrt(newPrice)) - 1/(Math.sqrt(price))
    let deltaX = oneOverDeltaP * L
    let deltaY = deltaP * L
    let Lx2 = amountX + deltaX
    let Ly2 = amountY + deltaY
    let newAssetValue = Lx2 * newPrice + Ly2
    return {newAssetValue,Lx2,Ly2}
}

const chart_opt_with_param = (xTitle,yTitle,zTitle,data,profitlow,profithigh) => {
        
    return {
    "animation": true,
    "animationThreshold": 2000,
    "animationDuration": 1000,
    "animationEasing": "cubicOut",
    "animationDelay": 0,
    "animationDurationUpdate": 300,
    "animationEasingUpdate": "cubicOut",
    "animationDelayUpdate": 0,
    "color": [
        "#c23531",
        "#2f4554",
        "#61a0a8",
        "#d48265",
        "#749f83",
        "#ca8622",
        "#bda29a",
        "#6e7074",
        "#546570",
        "#c4ccd3",
        "#f05b72",
        "#ef5b9c",
        "#f47920",
        "#905a3d",
        "#fab27b",
        "#2a5caa",
        "#444693",
        "#726930",
        "#b2d235",
        "#6d8346",
        "#ac6767",
        "#1d953f",
        "#6950a1",
        "#918597"
    ],
    "series": [
        {
            "type": "scatter3D",
            "data": data,
            "label": {
                "show": false,
                "position": "top",
                "margin": 8
            }
        }
    ],
    "legend": [
        {
            "data": [
                ""
            ],
            "selected": {},
            "show": true,
            "padding": 5,
            "itemGap": 10,
            "itemWidth": 25,
            "itemHeight": 14
        }
    ],
    "tooltip": {
        "show": true,
        "trigger": "item",
        "triggerOn": "mousemove|click",
        "axisPointer": {
            "type": "line"
        },
        "showContent": true,
        "alwaysShowContent": false,
        "showDelay": 0,
        "hideDelay": 100,
        "textStyle": {
            "fontSize": 14
        },
        "borderWidth": 0,
        "padding": 5
    },
    "visualMap": [
        {
            "show": true,
            "type": "continuous",
            "min": profitlow,
            "max": profithigh,
            "inRange": {
                "color": [
                    "#1710c0",
                    "#0b9df0",
                    "#00fea8",
                    "#00ff0d",
                    "#f5f811",
                    "#f09a09",
                    "#fe0300"
                ]
            },
            "calculable": true,
            "inverse": false,
            "splitNumber": 5,
            "dimension": 2,
            "orient": "vertical",
            "top": "10",
            "showLabel": true,
            "itemWidth": 20,
            "itemHeight": 140,
            "borderWidth": 0
        },
        {
            "show": true,
            "type": "continuous",
            "min": 0,
            "max": 1.2,
            "inRange": {
                "symbolSize": [
                    10,
                    10
                ]
            },
            "calculable": true,
            "inverse": false,
            "splitNumber": 5,
            "dimension": 4,
            "orient": "vertical",
            "bottom": "10",
            "showLabel": true,
            "itemWidth": 20,
            "itemHeight": 140,
            "borderWidth": 0
        }
    ],
    "xAxis3D": {
        "name": xTitle,
        "nameGap": 20,
        "type": "value",
        "axisLabel": {
            "margin": 8
        }
    },
    "yAxis3D": {
        "name": yTitle,
        "nameGap": 20,
        "type": "value",
        "axisLabel": {
            "margin": 8
        }
    },
    "zAxis3D": {
        "name": zTitle,
        "nameGap": 20,
        "type": "value",
        "axisLabel": {
            "margin": 8
        }
    },
    "grid3D": {
        "boxWidth": 100,
        "boxHeight": 100,
        "boxDepth": 100,
        "viewControl": {
            "autoRotate": false,
            "autoRotateSpeed": 10,
            "rotateSensitivity": 1
        }
    },
    "title": [
        {
            "padding": 5,
            "itemGap": 10
        }
    ]
    }
}

const simulate = () => {
    if(!chart_d){
        chart_d = echarts.init(document.getElementById('assetchart'), 'white', {renderer: 'canvas'})
    }
    // do simulate
    let initialCapital = 10000
    let initialPrice = 4000
    let USD_Price = 1
    let upper = 5000
    let lower = 2000
    let fee_rate = 0.3
    let initTVL = 159.27 * 1000000
    let TVLGrowRate = 0.05
    let tradevol_upper = 6000.59 * 1000000
    let tradevol_lower = 551.57 * 1000000
    let hedge_rto = 0.05
    let fundrate_upper = 0.03*0.01*3
    let fundrate_lower = 0.01*0.01*3
    
    const sliders_txt = document.getElementsByClassName("length__title")
    for (let i = 0; i < sliders_txt.length; i++){
        let sld = sliders_txt[i]
        if(sld.innerText.includes('Upper Price') ){
            upper = parseFloat(sld.parentElement.getElementsByClassName('slider')[0].value)
        }else if(sld.innerText.includes('Lower Price') ){
            lower = parseFloat(sld.parentElement.getElementsByClassName('slider')[0].value)
        }else if(sld.innerText.includes('Hedge Ratio')){
            let short_ratio = parseFloat(sld.parentElement.getElementsByClassName('slider')[0].value)
            hedge_rto = short_ratio*0.01
        }
    }
    
    const input_txt = document.getElementsByClassName("inputbox")
    for (let i = 0; i < input_txt.length; i++){
        let inp = input_txt[i]
        let title = inp.getElementsByClassName('field-title')[0].innerText
        if(title==='Initial Capital'){
            initialCapital = parseFloat(inp.getElementsByClassName('result__viewbox')[0].getAttribute('value'))
        }else if(title==='Initial Capital'){
            initialPrice = parseFloat(inp.getElementsByClassName('result__viewbox')[0].getAttribute('value'))
        }
    }
    
    scatter_points_raw = []
    scatter_points_raw_fee = []
    scatter_points = []
    scatter_points_hdeged = []
    

    let rwkd = getTokenAmountsFromDepositAmounts(initialPrice,lower,upper,initialPrice,USD_Price,initialCapital)
    let rawAmtEth = rwkd.deltaX
    let rawAmtUsd = rwkd.deltaY
    let rawLq = calcLiquidity(initialPrice,upper,lower,rawAmtEth,rawAmtUsd)

    let poolAsset = initialCapital - (initialCapital*hedge_rto)
    let inkd = getTokenAmountsFromDepositAmounts(initialPrice,lower,upper,initialPrice,USD_Price,poolAsset)
    let initialAmtEth = inkd.deltaX
    let initialAmtUsd = inkd.deltaY
    let initialLq = calcLiquidity(initialPrice,upper,lower,initialAmtEth,initialAmtUsd)
    
    
    
    for(let k = 1;k<initialPrice*2;k+=50){
        let feeIncome_raw_accu = 0
        let feeIncome_accu = 0
        let fundrate_income_accu = 0
        for(let d = 1;d<366;d+=5){
            let curp = k
            if(k>upper)
                curp = upper
            
            let rawlpc = getILPriceChange(initialPrice,curp,upper,lower,rawAmtEth,rawAmtUsd)
            let rawIL = rawlpc.newAssetValue
            if(rawIL<0)
                rawIL=0
            scatter_points_raw.push([d,k,rawIL])


            let nthDay_tvl = initTVL * (1+TVLGrowRate/30*d)
            let rand = Math.random()
            let todayVolEstimation = tradevol_lower + rand * (tradevol_upper - tradevol_lower)
            
            let feeIncome_rw = (rawLq / nthDay_tvl) * todayVolEstimation * (1+TVLGrowRate/30*d) * fee_rate * 0.01
            feeIncome_raw_accu += feeIncome_rw

            let rawIL_fee = rawIL + feeIncome_raw_accu
            scatter_points_raw_fee.push([d,k,rawIL_fee])


            let ilpc = getILPriceChange(initialPrice,curp,upper,lower,initialAmtEth,initialAmtUsd)
            let newAssetValue = ilpc.newAssetValue
            if(newAssetValue<0)
                newAssetValue=0
            
            let hedge_price = initialPrice
            let h_eth = (initialCapital*hedge_rto) / initialPrice
            const max_lvg = 10
            let _lvg = (1 - hedge_rto) / hedge_rto
            if(_lvg>max_lvg){
                _lvg = max_lvg
            }
            let nominalSz = _lvg*h_eth
            let uPnL = Math.max( h_eth*hedge_price + (hedge_price - k) * nominalSz , 0 )
            let fundrate = fundrate_lower + rand * (fundrate_upper - fundrate_lower)
            let fundrate_income = 0
            if(uPnL>0.001){
                fundrate_income =  h_eth * fundrate * hedge_price
                fundrate_income_accu += fundrate_income
            }

            let hedged_asset = newAssetValue + uPnL + fundrate_income_accu
            scatter_points_hdeged.push([d,k,hedged_asset])
            
            let feeIncome = (initialLq / nthDay_tvl) * todayVolEstimation * (1+TVLGrowRate/30*d) * fee_rate * 0.01
            feeIncome_accu += feeIncome

            let curCapital = hedged_asset + feeIncome_accu
            scatter_points.push([d,k,curCapital])

            //console.log(`day ${d} price${k} asset=${newAssetValue} fee ${feeIncome_accu} heg ${(uPnL+fundrate_income_accu)} total ${curCapital}` )

            
            if(rawIL_fee>profithigh){
                profithigh=rawIL_fee
            }
            if(newAssetValue>profithigh){
                profithigh=newAssetValue
            }
            if(curCapital>profithigh){
                profithigh=curCapital
            }
        }
    }
}

const toggleChartData = (visualType,froceRecalc=false) => {
    
    if(scatter_points_raw.length<1){
        simulate()
    }
    if(froceRecalc){
        simulate()
    }
    switch(visualType){
        case `raw`:{
            console.log(`Show non Hedged`);
            let opt1 = chart_opt_with_param("Day","Price","Asset Value",scatter_points_raw,profitlow,profithigh)
            chart_d.setOption(opt1)
        }
        break
        case `rawwithfee`:{
            console.log(`Show non Hedged with fee`);
            let opt1 = chart_opt_with_param("Day","Price","Asset Value",scatter_points_raw_fee,profitlow,profithigh)
            chart_d.setOption(opt1)
        }
        break
        case `hedge`:{
            console.log(`Show Hedged no fee`);
            let opt1 = chart_opt_with_param("Day","Price","Asset Value",scatter_points_hdeged,profitlow,profithigh)
            chart_d.setOption(opt1)
        }
        break
        case `hedgeandfee`:{
            console.log(`Show Hedged and fee`);
            let opt1 = chart_opt_with_param("Day","Price","Asset Value",scatter_points,profitlow,profithigh)
            chart_d.setOption(opt1)
        }
        break
    }
}
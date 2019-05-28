const express = require('express');
const app = express();
const SquareConnect = require('square-connect');
const {
  TransactionsApi,
  OrdersApi,
  LocationsApi
} = require('square-connect');
const defaultClient = SquareConnect.ApiClient.instance;
const crypto = require('crypto');
const bodyParser = require('body-parser');

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

let oauth2 = defaultClient.authentications['oauth2'];
oauth2.accessToken = "EAAAEBHDxWiUg2JIw4kZo43B6MyU7s0Fvz-tzPLXydXCTxAypzlgLGM5kYeEsrLm"; //process.env.ACCESS_TOKEN;

const transactionsApi = new TransactionsApi();
const ordersApi = new OrdersApi();
const locationsApi = new LocationsApi();

app.post('/pay', async (request, response) => {
  const requestBody = request.body;
  const locations = await locationsApi.listLocations();

  console.log(requestBody);
  console.log(requestBody.order_items);
  const locationId = locations.locations[0].id;

  const createOrderRequest = {
    idempotency_key: crypto.randomBytes(12).toString('hex'),
    order: {
      line_items: requestBody.order_items
    }
  }
  console.log("order object: ");
  console.log(createOrderRequest);
  /*[
        {
          name: "Cafe App Test Transaction",
          quantity: "1",
          base_price_money: {
            amount: 1,
            currency: "USD"
          }
        }
      ]*/

  const order = await ordersApi.createOrder(locationId, createOrderRequest);

  try {
    const chargeBody = {
      "idempotency_key": crypto.randomBytes(12).toString('hex'),
      "card_nonce": requestBody.nonce,
      "amount_money": {
        "amount": order.order.total_money.amount,
        "currency": order.order.total_money.currency
      },
      "order_id": order.order.id,
      "shipping_address" : requestBody.shipping_address
    };
    const transaction = await transactionsApi.charge(locationId, chargeBody);
    //console.log("transaction object: ");
    //console.log(transaction.transaction);

    response.status(200).json(transaction.transaction);
  } catch (e) {
    delete e.response.req.headers;
    delete e.response.req._headers;
    //console.log(`[Error] Status:${e.status}, Messages: ${JSON.stringify((JSON.parse(e.response.text)).errors, null, 2)}`);

    const { errors } = (JSON.parse(e.response.text));

    switch(errors[0].code) {
        case "CARD_DECLINED":
          response.status(400).send({
              errorMessage: "Card declined. Please re-enter card information."
          })
          break;
        case "VERIFY_CVV_FAILURE":
          response.status(400).send({
              errorMessage: "Invalid CVV. Please re-enter card information."
          })
          break;
        case "VERIFY_AVS_FAILURE":
          response.status(400).send({
              errorMessage: "Invalid Postal Code. Please re-enter card information."
          })
          break;
        case "INVALID_EXPIRATION":
          response.status(400).send({
              errorMessage: "Invalid expiration date. Please re-enter card information."
          })
          break;
        case "CARD_TOKEN_USED":
          response.status(400).send({
              errorMessage: "Card token already used; Please try re-entering card details."
          })
          break;
        case "INVALID_CARD":
          response.status(400).send({
              errorMessage: "Invalid card number; Please try re-entering card details."
          })
          break;
        default:
          response.status(400).send({
              errorMessage: "Payment error. Please contact support if issue persists."
          })
          break;
    }
  }
});

// listen for requests :)
const listener = app.listen(5123, function() { //process.env.PORT
  console.log('Your app is listening on port ' + listener.address().port);
});

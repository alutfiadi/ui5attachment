sap.ui.define(
  [
    "./BaseController",
    "sap/ui/model/json/JSONModel",
    "attachment/model/formatter",
    "sap/m/MessageToast",
    "sap/ui/core/Fragment",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/core/syncStyleClass",
    "sap/m/library",
    "sap/m/UploadCollectionParameter",
    "sap/ui/unified/FileUploaderParameter",
  ],
  /**
   * @param {typeof sap.ui.core.mvc.Controller} Controller
   */
  function (
    Controller,
    JSONModel,
    Formatter,
    MessageToast,
    Fragment,
    Filter,
    FilterOperator,
    syncStyleClass,
    MobileLibrary,
    UploadCollectionParameter,
    FileUploaderParameter
  ) {
    "use strict";

    return Controller.extend("attachment.controller.Home", {
      formatter: Formatter,

      /* =========================================================== */
      /* lifecycle methods                                           */
      /* =========================================================== */

      /**
       * Called when the main controller is instantiated.
       * @public
       */
      onInit: function () {
        var oViewModel;

        // Model used to manipulate control states
        oViewModel = new JSONModel({
          saveAsTileTitle: this.getResourceBundle().getText(
            "saveAsTileTitle",
            this.getResourceBundle().getText("mainViewTitle")
          ),
          shareOnJamTitle: this.getResourceBundle().getText("mainTitle"),
          shareSendEmailSubject: this.getResourceBundle().getText(
            "shareSendEmailMainSubject"
          ),
          shareSendEmailMessage: this.getResourceBundle().getText(
            "shareSendEmailMainMessage",
            [location.href]
          ),
          tableBusyDelay: 0,
        });
        this.setModel(oViewModel, "mainView");

        // Model used to manipulate Attachment states
        var ListMode = MobileLibrary.ListMode,
          ListSeparators = MobileLibrary.ListSeparators;
        var oAttachModel = new JSONModel({
          maximumFilenameLength: 55,
          maximumFileSize: 1000,
          mode: ListMode.SingleSelectMaster,
          uploadEnabled: true,
          uploadButtonVisible: true,
          enableEdit: false,
          enableDelete: true,
          visibleEdit: false,
          visibleDelete: true,
          listSeparatorItems: [ListSeparators.All, ListSeparators.None],
          showSeparators: ListSeparators.All,
          listModeItems: [
            {
              key: ListMode.SingleSelectMaster,
              text: "Single",
            },
            {
              key: ListMode.MultiSelect,
              text: "Multi",
            },
          ],
        });
        this.setModel(oAttachModel, "attachmentSettings");

        this.getView().setModel(
          new JSONModel({
            items: [
              "jpg",
              "txt",
              "ppt",
              "doc",
              "docx",
              "xls",
              "xlsx",
              "pdf",
              "png",
              "msg",
            ],
            selected: [
              "jpg",
              "txt",
              "ppt",
              "doc",
              "docx",
              "xls",
              "xlsx",
              "pdf",
              "png",
              "msg",
            ],
          }),
          "fileTypes"
        );

        this.getView().setModel(
          new JSONModel({
            ActionItems: [
              {
                Text: "Delete",
                Icon: "sap-icon://delete",
                Key: "delete",
              },
            ],
          }),
          "commentActionSet"
        );

        this.getView().setModel(
          new JSONModel({
            InstanceID: "000010000310",
            TypeID: "BUS2038",
            CategoryID: "BO",
          }),
          "gosObject"
        );

        // Place Holder for New Attachments
        this.aNewAttachments = [];

        // Sets the text to the label
        this.byId("attachmentBlock").addEventDelegate({
          onBeforeRendering: function () {
            this.byId("attachmentTitle").setText(
              this._getAttachmentTitleText()
            );
          }.bind(this),
        });

        this.getView().attachAfterRendering(
          function () {
            // Restore original busy indicator delay for the object view
            this._setUploadUrl();
            this._refreshAttachments();
            this._refreshComments();
          }.bind(this)
        );
        // Add the main page to the flp routing history
        this.addHistoryEntry(
          {
            title: this.getResourceBundle().getText("mainViewTitle"),
            icon: "sap-icon://table-view",
            intent: "#AttachmnetandCommentDemoApp-display",
          },
          true
        );
      },

      /* =========================================================== */
      /* event handlers                                              */
      /* =========================================================== */
      onAttachmentSettings: function (oEvent) {
        var oView = this.getView();

        if (!this._attachmentSettingsDialog) {
          this._attachmentSettingsDialog = Fragment.load({
            id: oView.getId(),
            name: "attachment.view.fragment.AttachmentSettings",
            controller: this,
          }).then(function (oAttachmentSettingsDialog) {
            oView.addDependent(oAttachmentSettingsDialog);
            return oAttachmentSettingsDialog;
          });
        }

        this._attachmentSettingsDialog.then(function (
          oAttachmentSettingsDialog
        ) {
          syncStyleClass("sapUiSizeCompact", oView, oAttachmentSettingsDialog);
          oAttachmentSettingsDialog.setContentWidth("42rem");
          oAttachmentSettingsDialog.open();
        });
      },

      onAttachmentDialogCloseButton: function () {
        this._attachmentSettingsDialog.then(function (
          oAttachmentSettingsDialog
        ) {
          oAttachmentSettingsDialog.close();
        });
      },

      onGOSSettings: function (oEvent) {
        var oView = this.getView();

        if (!this._gosSettingsDialog) {
          this._gosSettingsDialog = Fragment.load({
            id: oView.getId(),
            name: "attachment.view.fragment.GOSSettings",
            controller: this,
          }).then(function (oGOSSettingsDialog) {
            oView.addDependent(oGOSSettingsDialog);
            return oGOSSettingsDialog;
          });
        }

        this._gosSettingsDialog.then(function (oGOSSettingsDialog) {
          syncStyleClass("sapUiSizeCompact", oView, oGOSSettingsDialog);
          oGOSSettingsDialog.setContentWidth("42rem");
          oGOSSettingsDialog.open();
        });
      },

      onGOSDialogCloseButton: function () {
        this._gosSettingsDialog.then(function (oGOSSettingsDialog) {
          oGOSSettingsDialog.close();
        });
        this._setUploadUrl();
      },

      onAttachmentChange: function (oEvent) {
        var oUploadCollection = oEvent.getSource();

        // Header Token
        this.getView().getModel().refreshSecurityToken();

        var oHeaders = this.getView().getModel().oHeaders;
        var sToken = oHeaders["x-csrf-token"];
        var oCustomerHeaderToken = new UploadCollectionParameter({
          name: "x-csrf-token",
          value: sToken,
        });
        oUploadCollection.addHeaderParameter(oCustomerHeaderToken);

        var oCustomerRequestToken = new UploadCollectionParameter({
          name: "x-requested-with",
          value: "X",
        });
        oUploadCollection.addHeaderParameter(oCustomerRequestToken);

        var oCustomerAcceptToken = new UploadCollectionParameter({
          name: "Accept",
          value: "application/json",
        });
        oUploadCollection.addHeaderParameter(oCustomerAcceptToken);
      },

      onFileDeleted: function (oEvent) {
        var oItem = oEvent.getParameter("item"),
          sPath = oItem.getBindingContext().getPath(),
          sFileName = oEvent.getParameter("item").getProperty("fileName"),
          oModel = this.byId("attachmentBlock").getModel(),
          fnSuccess = function () {
            this._refreshAttachments();
            MessageToast.show("File '" + sFileName + "' is Deleted");
          }.bind(this),
          fnError = function (oError) {
            MessageToast.show(
              "Error ocurred: Check Message Popover at bottom left"
            );
          }.bind(this);

        oModel.remove(sPath, { success: fnSuccess, error: fnError });
      },

      onFilenameLengthExceed: function () {
        var oSetting = this.getView().getModel("attachmentSettings"),
          sMaxLength = oSetting.getProperty("maximumFilenameLength");
        MessageToast.show(
          "Allowed length for Filename is " + sMaxLength + " Characters"
        );
      },

      onFileRenamed: function (oEvent) {
        var oItem = oEvent.getParameter("item"),
          sObject = oItem.getBindingContext().getObject(),
          sPath = oItem.getBindingContext().getPath(),
          sFileName = oEvent.getParameter("fileName"),
          fnSuccess = function () {
            MessageToast.show("File Renamed Successfully");
          },
          fnError = function (oError) {
            MessageToast.show(
              "Error ocurred: Check Message Popover at bottom left"
            );
          },
          sendData = {
            InstanceID: sObject.InstanceID,
            TypeID: sObject.TypeID,
            CategoryID: sObject.CategoryID,
            FileName: sFileName,
            FileSize: sObject.FileSize,
            CreatedBy: sObject.CreatedBy,
            CreatedByName: sObject.CreatedByName,
            CreatedAt: sObject.CreatedAt,
            MimeType: sObject.MimeType,
          },
          oAttachModel = this.getView().getModel();

        oAttachModel.update(sPath, sendData, {
          success: fnSuccess,
          error: fnError,
        });
        this._refreshAttachments();
      },

      onFileTypeMissmatch: function () {
        var oFileTypes = this.getView().getModel("fileTypes"),
          sAllowed = oFileTypes.getData().selected.toString();

        MessageToast.show("Allowed File Types are " + sAllowed);
      },

      onFileUploadComplete: function (oEvent) {
        var sParameters = oEvent.getParameter("mParameters");
        var oResponseJson = JSON.parse(sParameters.responseRaw);
        this.aNewAttachments.push(oResponseJson.d.Id);

        this._refreshAttachments();

        // delay the success message for to notice onChange message
        MessageToast.show("File Upload Completed");
      },

      onBeforeFileUploadStarts: function (oEvent) {
        // Header Slug
        var oCustomerHeaderSlug = new UploadCollectionParameter({
          name: "slug",
          value: oEvent.getParameter("fileName"),
        });
        oEvent.getParameters().addHeaderParameter(oCustomerHeaderSlug);

        MessageToast.show("File Upload Started");
      },

      onFileUploadTerminated: function () {
        /*
			// get parameter file name
			var sFileName = oEvent.getParameter("fileName");
			// get a header parameter (in case no parameter specified, the callback function getHeaderParameter returns all request headers)
			var oRequestHeaders = oEvent.getParameters().getHeaderParameter();
			*/
      },

      onDeleteAttachmentAll: function () {
        var aAttachItems = this.getView().byId("attachmentBlock").getItems(),
          oAttachModel = this.getView().getModel();

        oAttachModel.setUseBatch(true);

        aAttachItems.forEach(
          function deleteAttach(oItem, sIndex) {
            oAttachModel.setDeferredGroups(["delAtt" + sIndex]);
            var sPath = oItem.getBindingContext().getPath();
            oAttachModel.remove(sPath, { groupId: "delAtt" + sIndex });
          }.bind(this)
        );

        oAttachModel.submitChanges();
        this._refreshAttachments();
      },

      onDeleteAttachmentNew: function () {
        var sGosData = this.getModel("gosObject").getData(),
          oAttachModel = this.getView().getModel();

        oAttachModel.setUseBatch(true);

        this.aNewAttachments.forEach(
          function deleteAttach(sId, sIndex) {
            oAttachModel.setDeferredGroups(["delAtt" + sIndex]);
            var sPath = this.getView().getModel().createKey("AttachmentSet", {
              InstanceID: sGosData.InstanceID,
              TypeID: sGosData.TypeID,
              CategoryID: sGosData.CategoryID,
              Id: sId,
            });
            sPath = "/" + sPath;
            oAttachModel.remove(sPath, { groupId: "delAtt" + sIndex });
          }.bind(this)
        );

        oAttachModel.submitChanges();
        this._refreshAttachments();
      },

      onPostComment: function (oEvent) {
        var fnSuccess = function () {
            MessageToast.show("Comment is Posted Successfully");
          },
          fnError = function (oError) {
            MessageToast.show(
              "Error ocurred: Check Message Popover at bottom left"
            );
          },
          sGosData = this.getModel("gosObject").getData(),
          sComment = oEvent.getParameter("value"),
          sendData = {
            InstanceID: sGosData.InstanceID,
            TypeID: sGosData.TypeID,
            CategoryID: sGosData.CategoryID,
            Id: "",
            Note: sComment,
          },
          oModel = this.getView().getModel();
        oModel.create("/CommentSet", sendData, {
          success: fnSuccess,
          error: fnError,
        });
        this._refreshComments();
      },

      onCommentActionPressed: function (oEvent) {
        var sAction = oEvent.getSource().getKey(),
          oItem = oEvent.getParameter("item"),
          sPath = oItem.getBindingContext().getPath(),
          oAttachModel = this.getView().getModel();

        if (sAction === "delete") {
          oAttachModel.remove(sPath);
          MessageToast.show("Comment deleted");
        }
      },

      handleUploadPress: function () {
        var oFileUploader = this.byId("fileUploader");
        oFileUploader
          .checkFileReadable()
          .then(
            function () {
              oFileUploader.upload();
            },
            function (error) {
              MessageToast.show(
                "The file cannot be read. It may have changed."
              );
            }
          )
          .then(function () {
            oFileUploader.clear();
          });
      },
      onUploadChange: function (oEvent) {
        var oFileUploader = oEvent.getSource();

        // Header Token
        this.getView().getModel().refreshSecurityToken();

        var oHeaders = this.getView().getModel().oHeaders;
        var sToken = oHeaders["x-csrf-token"];
        var oCustomerHeaderToken = new FileUploaderParameter({
          name: "x-csrf-token",
          value: sToken,
        });
        oFileUploader.addHeaderParameter(oCustomerHeaderToken);

        var oCustomerRequestToken = new FileUploaderParameter({
          name: "x-requested-with",
          value: "X",
        });
        oFileUploader.addHeaderParameter(oCustomerRequestToken);

        var oCustomerAcceptToken = new FileUploaderParameter({
          name: "Accept",
          value: "application/json",
        });
        oFileUploader.addHeaderParameter(oCustomerAcceptToken);
      },
      handleUploadComplete: function (oEvent) {
        var sResponse = oEvent.getParameter("response"),
          iHttpStatusCode = parseInt(/\d{3}/.exec(sResponse)[0]),
          sMessage;

        if (sResponse) {
          sMessage =
            iHttpStatusCode === 200
              ? sResponse + " (Upload Success)"
              : sResponse + " (Upload Error)";
          MessageToast.show(sMessage);
        }
      },
      uploadFile: function (oEvent) {
        var that = this;
        var oFileUploader = this.getView().byId("fileUploader");
        this.csrfToken = this.getView().getModel().getSecurityToken();
        oFileUploader.setSendXHR(true);

        var headerParma = new sap.ui.unified.FileUploaderParameter();
        headerParma.setName("x-csrf-token");
        headerParma.setValue(this.csrfToken);
        oFileUploader.addHeaderParameter(headerParma);

        var headerParma2 = new sap.ui.unified.FileUploaderParameter();
        headerParma2.setName("slug");
        headerParma2.setValue(oFileUploader.getValue());
        oFileUploader.addHeaderParameter(headerParma2);

        oFileUploader
          .checkFileReadable()
          .then(
            function () {
              oFileUploader.upload();
              oFileUploader.destroyHeaderParameters();
            },
            function (error) {
              sap.m.MessageToast.show(
                "The file cannot be read. It may have changed."
              );
            }
          )
          .then(function () {
            oFileUploader.clear();
            that._refreshAttachments();
          });
      },
      handleBase64: function () {
        function b64toBlob(b64Data, contentType, sliceSize) {
          contentType = contentType || "";
          sliceSize = sliceSize || 512;

          var byteCharacters = atob(b64Data);
          var byteArrays = [];

          for (
            var offset = 0;
            offset < byteCharacters.length;
            offset += sliceSize
          ) {
            var slice = byteCharacters.slice(offset, offset + sliceSize);

            var byteNumbers = new Array(slice.length);
            for (var i = 0; i < slice.length; i++) {
              byteNumbers[i] = slice.charCodeAt(i);
            }

            var byteArray = new Uint8Array(byteNumbers);

            byteArrays.push(byteArray);
          }

          var blob = new Blob(byteArrays, { type: contentType });
          return blob;
        }
        var ImageURL =
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAApgAAAKYB3X3/OAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAANCSURBVEiJtZZPbBtFFMZ/M7ubXdtdb1xSFyeilBapySVU8h8OoFaooFSqiihIVIpQBKci6KEg9Q6H9kovIHoCIVQJJCKE1ENFjnAgcaSGC6rEnxBwA04Tx43t2FnvDAfjkNibxgHxnWb2e/u992bee7tCa00YFsffekFY+nUzFtjW0LrvjRXrCDIAaPLlW0nHL0SsZtVoaF98mLrx3pdhOqLtYPHChahZcYYO7KvPFxvRl5XPp1sN3adWiD1ZAqD6XYK1b/dvE5IWryTt2udLFedwc1+9kLp+vbbpoDh+6TklxBeAi9TL0taeWpdmZzQDry0AcO+jQ12RyohqqoYoo8RDwJrU+qXkjWtfi8Xxt58BdQuwQs9qC/afLwCw8tnQbqYAPsgxE1S6F3EAIXux2oQFKm0ihMsOF71dHYx+f3NND68ghCu1YIoePPQN1pGRABkJ6Bus96CutRZMydTl+TvuiRW1m3n0eDl0vRPcEysqdXn+jsQPsrHMquGeXEaY4Yk4wxWcY5V/9scqOMOVUFthatyTy8QyqwZ+kDURKoMWxNKr2EeqVKcTNOajqKoBgOE28U4tdQl5p5bwCw7BWquaZSzAPlwjlithJtp3pTImSqQRrb2Z8PHGigD4RZuNX6JYj6wj7O4TFLbCO/Mn/m8R+h6rYSUb3ekokRY6f/YukArN979jcW+V/S8g0eT/N3VN3kTqWbQ428m9/8k0P/1aIhF36PccEl6EhOcAUCrXKZXXWS3XKd2vc/TRBG9O5ELC17MmWubD2nKhUKZa26Ba2+D3P+4/MNCFwg59oWVeYhkzgN/JDR8deKBoD7Y+ljEjGZ0sosXVTvbc6RHirr2reNy1OXd6pJsQ+gqjk8VWFYmHrwBzW/n+uMPFiRwHB2I7ih8ciHFxIkd/3Omk5tCDV1t+2nNu5sxxpDFNx+huNhVT3/zMDz8usXC3ddaHBj1GHj/As08fwTS7Kt1HBTmyN29vdwAw+/wbwLVOJ3uAD1wi/dUH7Qei66PfyuRj4Ik9is+hglfbkbfR3cnZm7chlUWLdwmprtCohX4HUtlOcQjLYCu+fzGJH2QRKvP3UNz8bWk1qMxjGTOMThZ3kvgLI5AzFfo379UAAAAASUVORK5CYII=";
        var base64img =
          "iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAApgAAAKYB3X3/OAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAANCSURBVEiJtZZPbBtFFMZ/M7ubXdtdb1xSFyeilBapySVU8h8OoFaooFSqiihIVIpQBKci6KEg9Q6H9kovIHoCIVQJJCKE1ENFjnAgcaSGC6rEnxBwA04Tx43t2FnvDAfjkNibxgHxnWb2e/u992bee7tCa00YFsffekFY+nUzFtjW0LrvjRXrCDIAaPLlW0nHL0SsZtVoaF98mLrx3pdhOqLtYPHChahZcYYO7KvPFxvRl5XPp1sN3adWiD1ZAqD6XYK1b/dvE5IWryTt2udLFedwc1+9kLp+vbbpoDh+6TklxBeAi9TL0taeWpdmZzQDry0AcO+jQ12RyohqqoYoo8RDwJrU+qXkjWtfi8Xxt58BdQuwQs9qC/afLwCw8tnQbqYAPsgxE1S6F3EAIXux2oQFKm0ihMsOF71dHYx+f3NND68ghCu1YIoePPQN1pGRABkJ6Bus96CutRZMydTl+TvuiRW1m3n0eDl0vRPcEysqdXn+jsQPsrHMquGeXEaY4Yk4wxWcY5V/9scqOMOVUFthatyTy8QyqwZ+kDURKoMWxNKr2EeqVKcTNOajqKoBgOE28U4tdQl5p5bwCw7BWquaZSzAPlwjlithJtp3pTImSqQRrb2Z8PHGigD4RZuNX6JYj6wj7O4TFLbCO/Mn/m8R+h6rYSUb3ekokRY6f/YukArN979jcW+V/S8g0eT/N3VN3kTqWbQ428m9/8k0P/1aIhF36PccEl6EhOcAUCrXKZXXWS3XKd2vc/TRBG9O5ELC17MmWubD2nKhUKZa26Ba2+D3P+4/MNCFwg59oWVeYhkzgN/JDR8deKBoD7Y+ljEjGZ0sosXVTvbc6RHirr2reNy1OXd6pJsQ+gqjk8VWFYmHrwBzW/n+uMPFiRwHB2I7ih8ciHFxIkd/3Omk5tCDV1t+2nNu5sxxpDFNx+huNhVT3/zMDz8usXC3ddaHBj1GHj/As08fwTS7Kt1HBTmyN29vdwAw+/wbwLVOJ3uAD1wi/dUH7Qei66PfyuRj4Ik9is+hglfbkbfR3cnZm7chlUWLdwmprtCohX4HUtlOcQjLYCu+fzGJH2QRKvP3UNz8bWk1qMxjGTOMThZ3kvgLI5AzFfo379UAAAAASUVORK5CYII=";
        // Split the base64 string in data and contentType
        var block = ImageURL.split(";");
        // Get the content type of the image
        var contentType = block[0].split(":")[1]; // In this case "image/gif"
        // get the real base64 content of the file
        var realData = block[1].split(",")[1]; // In this case "R0lGODlhPQBEAPeoAJosM...."

        // Convert it to a blob to upload
        var blob = b64toBlob(realData, contentType);
        console.log({ blob });

        var oFileUploader = this.getView().byId("fileUploader");
        var container = new DataTransfer();
        let data = new Blob();
        let file = new File(
          [blob],
          "p" + Math.floor(Math.random() * 1000) + ".jpg",
          {
            type: blob.type,
            lastModified: new Date().getTime(),
          }
        );
        container.items.add(file);
        const blobURL = window.URL.createObjectURL(blob); // This is the blob url
        console.log({ blobURL });
        oFileUploader.files = container.files;
        // oFileUploader.setValue(blobURL);

        console.log({ file });
        var sGosData = this.getModel("gosObject").getData();
        var sPath = this.getView().getModel().sServiceUrl;
        sPath =
          sPath +
          "/" +
          this.getView().getModel().createKey("AttachKeySet", {
            InstanceID: sGosData.InstanceID,
            TypeID: sGosData.TypeID,
            CategoryID: sGosData.CategoryID,
          }) +
          "/AttachmentSet";

        var csrfToken = this.getView().getModel().getSecurityToken();
        //-----------CARA 0
        var oReq = new XMLHttpRequest();
        oReq.open("POST", sPath);
        //Set Header
        oReq.setRequestHeader("x-csrf-token", csrfToken);
        oReq.setRequestHeader("slug", file.name);
        oReq.setRequestHeader("X-Requested-With", "XMLHttpRequest");
        oReq.setRequestHeader("X-File-Name", file.name);
        oReq.setRequestHeader("Content-Type",file.type || "application/octet-stream");
        oReq.onload = function (oEvent) {
          // Uploaded.
          console.log({ oEvent });
        };
        var oFormData = new FormData();
        oFormData.append("image", blob);
        oReq.send(file);

        //-----------CARA 1
        // var reqA = jQuery.ajax({
        //   url: sPath,
        //   method: "POST",
        //   data: oFormData, // sends fields with filename mimetype etc
        //   // data: oFileUploader.files[0], // optional just sends the binary
        //   processData: false, // don't let jquery process the data
        //   contentType: false, // let xhr set the content type
        //   headers: {
        //     "X-CSRF-TOKEN": csrfToken,
        //   },
        // });
        // reqA.then(
        //   function (response) {
        //     console.log(response);
        //   },
        //   function (xhr) {
        //     console.error("failed to fetch xhr", xhr);
        //   }
        // );

        //-----------CARA 2
        // base64img = JSON.stringify(base64img);
        // var encoded = btoa(unescape(encodeURIComponent(base64img)));
        // var oEntry ={
        //   Value: encoded,
        //   KEY: "X"
        // };
        // $.ajax({
        //   url: sPath,
        //   // dataType: 'json',
        //   // data: oFormData,
        //   // data: file,
        //   type: "POST",
        //   headers: {
        //     "X-Requested-With": "XMLHttpRequest",
        //     "Content-Type": file.type,
        //     "Accept": "application/atom+xml,application/atomsvc+xml,application/xml",
        //     "X-CSRF-Token": csrfToken,
        //     slug: file.name,
        //   },
        //   success: function (data) {
        //     // debugger;
        //     console.log(data);
        //   },
        //   error: function (err) {
        //     // debugger;
        //     console.log({err});
        //   },
        // });

        //-----------CARA 3
        // var that = this;
        // oFileUploader.getProcessedBlobsFromArray(blob)
        // .then(function () {
        //   that.uploadFile();
        //   // that._refreshAttachments();
        // })
      },
      onDialogClose: function (oEvent) {
        var oFileUploader = this.getView().byId("fileUploader");
        console.log({ oFileUploader });
      },
      /* =========================================================== */
      /* internal methods                                            */
      /* =========================================================== */
      _getAttachmentTitleText: function () {
        var aItems = this.byId("attachmentBlock").getItems();
        return "Attachments (" + aItems.length + ")";
      },

      _setUploadUrl: function () {
        // Attachment Upload Path
        var oUploadCollection = this.byId("attachmentBlock");
        var oFileUploader = this.byId("fileUploader");
        var sGosData = this.getModel("gosObject").getData();
        var sPath = this.getView().getModel().sServiceUrl;
        sPath =
          sPath +
          "/" +
          this.getView().getModel().createKey("AttachKeySet", {
            InstanceID: sGosData.InstanceID,
            TypeID: sGosData.TypeID,
            CategoryID: sGosData.CategoryID,
          }) +
          "/AttachmentSet";
        oUploadCollection.setUploadUrl(sPath);
        oFileUploader.setUploadUrl(sPath);
      },

      _refreshAttachments: function () {
        var sGosData = this.getModel("gosObject").getData();
        var oUploadCollection = this.byId("attachmentBlock");
        var aFilters = [
          new sap.ui.model.Filter(
            "InstanceID",
            sap.ui.model.FilterOperator.EQ,
            sGosData.InstanceID
          ),
          new sap.ui.model.Filter(
            "TypeID",
            sap.ui.model.FilterOperator.EQ,
            sGosData.TypeID
          ),
          new sap.ui.model.Filter(
            "CategoryID",
            sap.ui.model.FilterOperator.EQ,
            sGosData.CategoryID
          ),
        ];
        oUploadCollection.getBinding("items").filter(aFilters);
      },

      _refreshComments: function () {
        var sGosData = this.getModel("gosObject").getData();
        var oCommentList = this.byId("commentBlock");
        var aFilters = [
          new sap.ui.model.Filter(
            "InstanceID",
            sap.ui.model.FilterOperator.EQ,
            sGosData.InstanceID
          ),
          new sap.ui.model.Filter(
            "TypeID",
            sap.ui.model.FilterOperator.EQ,
            sGosData.TypeID
          ),
          new sap.ui.model.Filter(
            "CategoryID",
            sap.ui.model.FilterOperator.EQ,
            sGosData.CategoryID
          ),
        ];
        oCommentList.getBinding("items").filter(aFilters);
      },
    });
  }
);

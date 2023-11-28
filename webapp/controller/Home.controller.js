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
        // "data:image/png;base64,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"
        
          // Split the base64 string in data and contentType
        var block = ImageURL.split(";");
        // Get the content type of the image
        var contentType = block[0].split(":")[1]; // In this case "image/gif"
        // get the real base64 content of the file
        var realData = block[1].split(",")[1]; // In this case "R0lGODlhPQBEAPeoAJosM...."
        // Convert it to a blob to upload
        var blob = b64toBlob(realData, contentType);
        console.log({ blob });

        // var oFileUploader = this.getView().byId("fileUploader");
        // var container = new DataTransfer();
        let file = new File([blob],"p" + Math.floor(Math.random() * 1000) + ".jpg",
          {
            type: blob.type,
            lastModified: new Date().getTime(),
          }
        );
        // container.items.add(file);
        const blobURL = window.URL.createObjectURL(blob); // This is the blob url
        console.log({ blobURL });
        // oFileUploader.files = container.files;
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
        oReq.setRequestHeader(
          "Content-Type",
          file.type || "application/octet-stream"
        );
        oReq.onload = function (oEvent) {
          // Uploaded.
          console.log({ oEvent });
        };
        // var oFormData = new FormData();
        // oFormData.append("image", blob);
        oReq.send(file);

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
